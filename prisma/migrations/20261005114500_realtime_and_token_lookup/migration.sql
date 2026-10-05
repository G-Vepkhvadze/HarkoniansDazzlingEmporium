-- Fast lookup for new character bearer tokens. Existing rows remain valid
-- because the column is nullable; they are backfilled on first successful use.
ALTER TABLE "CharacterApiToken"
ADD COLUMN "tokenFingerprint" TEXT;

CREATE UNIQUE INDEX "CharacterApiToken_tokenFingerprint_key"
ON "CharacterApiToken"("tokenFingerprint");

-- --------------------------------------------------------------------------
-- Supabase Realtime Authorization
-- --------------------------------------------------------------------------
-- realtime.messages already has RLS enabled and is managed by Supabase.
-- We only create the SELECT policy needed for private Harkonians character
-- channels. The custom JWT issued by the app uses the Character.id as `sub`.

DROP POLICY IF EXISTS "Harkonians characters can receive private broadcasts"
ON realtime.messages;

CREATE POLICY "Harkonians characters can receive private broadcasts"
ON realtime.messages
FOR SELECT
                    TO authenticated
                    USING (
                    extension = 'broadcast'
                    AND (SELECT realtime.topic()) =
                    'foundry:character:' ||
                    (
                    (SELECT current_setting('request.jwt.claims', true)::jsonb)
                    ->> 'character_id'
                    )
                    );

-- --------------------------------------------------------------------------
-- Database-driven Broadcast triggers
-- --------------------------------------------------------------------------
-- PostgreSQL remains authoritative. Realtime is an acceleration/notification
-- layer only. Trigger failures are deliberately swallowed so a Realtime outage
-- can never roll back a purchase, gold update, or stock update; Foundry's
-- durable /pending and /state endpoints remain the recovery path.

CREATE OR REPLACE FUNCTION public.harkonians_broadcast_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id text;
BEGIN
  SELECT c."foundryActorId"
    INTO v_actor_id
  FROM public."Character" AS c
  WHERE c."id" = NEW."characterId";

  IF v_actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'purchaseId', NEW."id",
        'actorId', v_actor_id,
        'quantity', NEW."quantity"
      ),
      'purchase',
      'foundry:character:' || NEW."characterId"::text,
      true
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Harkonians purchase realtime broadcast failed for %: %', NEW."id", SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS harkonians_purchase_realtime
ON public."Purchase";

CREATE TRIGGER harkonians_purchase_realtime
AFTER INSERT ON public."Purchase"
FOR EACH ROW
EXECUTE FUNCTION public.harkonians_broadcast_purchase();

CREATE OR REPLACE FUNCTION public.harkonians_broadcast_character_gold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW."creditBalance" IS NOT DISTINCT FROM OLD."creditBalance" THEN
    RETURN NEW;
  END IF;

  IF NEW."foundryActorId" IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'characterId', NEW."id",
        'actorId', NEW."foundryActorId",
        'gold', NEW."creditBalance"
      ),
      'gold_update',
      'foundry:character:' || NEW."id"::text,
      true
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Harkonians gold realtime broadcast failed for %: %', NEW."id", SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS harkonians_character_gold_realtime
ON public."Character";

CREATE TRIGGER harkonians_character_gold_realtime
AFTER UPDATE OF "creditBalance" ON public."Character"
FOR EACH ROW
EXECUTE FUNCTION public.harkonians_broadcast_character_gold();

CREATE OR REPLACE FUNCTION public.harkonians_broadcast_item_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_foundry_world_id text;
  v_character record;
BEGIN
  IF NEW."stock" IS NOT DISTINCT FROM OLD."stock" THEN
    RETURN NEW;
  END IF;

  v_foundry_world_id := NEW."foundryItemData" #>> '{_harkoniansMetadata,foundryWorldId}';

  IF v_foundry_world_id IS NULL OR v_foundry_world_id = '' THEN
    RETURN NEW;
  END IF;

  FOR v_character IN
    SELECT c."id"
    FROM public."Character" AS c
    WHERE c."foundryWorldId" = v_foundry_world_id
      AND c."foundryActorId" IS NOT NULL
  LOOP
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object(
          'itemId', NEW."id",
          'stock', NEW."stock"
        ),
        'stock_update',
        'foundry:character:' || v_character."id"::text,
        true
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Harkonians stock realtime broadcast failed for item % / character %: %', NEW."id", v_character."id", SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS harkonians_item_stock_realtime
ON public."Item";

CREATE TRIGGER harkonians_item_stock_realtime
AFTER UPDATE OF "stock" ON public."Item"
FOR EACH ROW
EXECUTE FUNCTION public.harkonians_broadcast_item_stock();
