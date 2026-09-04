// src/utils/verificationHelper.js
// Standardized filter helper for startups requiring admin verification review.

export const isPendingVerification = (s) => {
  if (!s) return false;
  const status = (s.status || '').toLowerCase().trim();
  const verStatus = (s.verification_status || '').toLowerCase().trim();

  // Explicitly exclude non-pending / finalized / draft / payment lifecycle states
  if (['draft', 'pending_payment', 'paid', 'active', 'approved', 'rejected'].includes(status)) {
    return false;
  }

  // Include actionable pending verification states
  return status === 'pending_verification' || 
         status === 'pending_documents' || 
         status === 'reviewing' || 
         status === 'pending' || 
         verStatus === 'pending';
};
