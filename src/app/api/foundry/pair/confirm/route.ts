import {validatePairingCode} from "@/lib/foundry";

export async function completeWorldPairing(
    pairingCode: string,
    foundryWorldId: string
): Promise<{
  success: boolean;
  world?: {
    id: string;
    foundryWorldId: string;
  };
  worldSecret?: string;
  error?: string;
}> {
  if (!pairingCode?.trim()) {
    return {
      success: false,
      error: "Pairing code is required."
    };
  }

  if (!foundryWorldId?.trim()) {
    return {
      success: false,
      error: "Foundry world ID is required."
    };
  }

  const pairingData = await validatePairingCode(pairingCode);

  if (!pairingData) {
    return {
      success: false,
      error: "Invalid, expired, or already used pairing code."
    };
  }

  const { raw: worldSecret, hash: worldSecretHash } =
      await (await import("../crypto")).generateWorldSecret();

  let world;

  if (pairingData.katastroWorldId) {
    world = await prisma.katastroWorld.update({
      where: {
        id: pairingData.katastroWorldId
      },
      data: {
        foundryWorldId,
        dmUserId: pairingData.userId,
        worldSecretHash
      },
      select: {
        id: true,
        foundryWorldId: true
      }
    });
  } else {
    world = await prisma.katastroWorld.create({
      data: {
        worldSecretHash,
        foundryWorldId,
        dmUserId: pairingData.userId
      },
      select: {
        id: true,
        foundryWorldId: true
      }
    });
  }

  /*
   * Consume the pairing code only after the world update succeeds.
   */
  await prisma.foundryPairingCode.update({
    where: {
      id: pairingData.id
    },
    data: {
      used: true
    }
  });

  return {
    success: true,
    world,
    worldSecret
  };
}