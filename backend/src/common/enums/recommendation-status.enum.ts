// PENDING -> patient approves (APPROVED) or rejects (REJECTED)
// APPROVED -> test paid -> BOOKED -> center completes -> COMPLETED
export enum RecommendationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BOOKED = 'BOOKED',
  COMPLETED = 'COMPLETED',
}
