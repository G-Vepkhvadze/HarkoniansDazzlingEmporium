import AddAppraisal from "@/components/AddAppraisal/AddAppraisal";
import AppraisalCard from "@/components/AppraisalCard/AppraisalCard";
import { getAppraisals } from "@/lib/appraisals";
import LocomotiveScrollProvider from "@/components/locomotiveScroll/LocomotiveScroll";
import { getCurrentUser } from "@/lib/auth/index";

export const dynamic = "force-dynamic";

export default async function AppraisalsPage() {
  const appraisals = await getAppraisals();
  const currentUser = await getCurrentUser();

  return (
    <div className="stacked-page appraisals-page">
      <LocomotiveScrollProvider />
      <section className="page-intro appraisals-page__intro">
        <p className="eyebrow">Appraisals</p>
        <h1>Appraisals</h1>
        <p>Discover the stories and worth of curious finds from across the realms.</p>
      </section>

      <section className="appraisals-section">
        <div className="appraisals-page__header">
          <div className="section-heading">
            <p>Appraised Treasures</p>
            <h2>Finds assessed by the Emporium.</h2>
          </div>
          <AddAppraisal />
        </div>

        {appraisals.length === 0 ? (
          <div className="appraisals-empty"><p>No appraisals yet. Check back for curious finds!</p></div>
        ) : (
          <div className="appraisals-grid">
            {appraisals.map((appraisal) => (
              <AppraisalCard
                key={appraisal.id}
                id={appraisal.id}
                itemName={appraisal.itemName}
                itemDescription={appraisal.itemDescription}
                canRemove={currentUser?.role === "DM"}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
