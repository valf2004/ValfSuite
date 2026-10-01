export type RevenueSource="website"|"phone"|"booking"|"airbnb"|"walk_in"|"other"|"unknown";
export type RevenueStay={id:string;status:string;archiveOutcome:string|null;arrivalDate:string;departureDate:string;amountCents:number|null;source:RevenueSource};
export type RevenueRequest={id:string;status:string;archiveOutcome:string|null;sourceRequestId:string|null;relationReason:string|null;message:string;arrivalDate:string;departureDate:string;quoteAmountCents:number|null};
export const revenueSources:{id:RevenueSource;label:string;color:string}[];
export function prepareRevenueStays(requests:RevenueRequest[]):RevenueStay[];
export function revenueYears(stays:RevenueStay[],currentYear:number):number[];
export function buildRevenueStatistics(stays:RevenueStay[],options:{granularity:"week"|"month"|"year";year:number;source?:RevenueSource|"all";scope?:"confirmed"|"completed";today:string}):{rows:{key:string;start:number;end:number;startDate:string;endDate:string;totalCents:number;bySource:Record<RevenueSource,number>;stayCount:number;missingCount:number}[];totalCents:number;stayCount:number;missingCount:number;sourceTotals:Record<RevenueSource,number>};
