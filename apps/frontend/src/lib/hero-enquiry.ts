export type HeroEnquiryValues = { full_name:string; email:string; details:string };
export function validateHeroEnquiry(values:HeroEnquiryValues) {
 const errors:Partial<Record<keyof HeroEnquiryValues,string>>={};
 if(values.full_name.trim().length<2||values.full_name.trim().length>100)errors.full_name='Please enter your full name (2–100 characters).';
 if(values.email.trim().length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))errors.email='Please enter a valid email address.';
 if(values.details.length>2000)errors.details='Please keep your details under 2,000 characters.';
 return errors;
}
export type HeroEnquiryResult = {formKind:'hero';success:boolean;message:string;values:HeroEnquiryValues|null;errors:Partial<Record<keyof HeroEnquiryValues,string>>};
