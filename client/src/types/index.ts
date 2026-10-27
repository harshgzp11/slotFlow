export type MembershipRole = 'OWNER' | 'MANAGER' | 'STAFF';

export interface IUser {
  id: string;
  name: string;
  email: string;
  systemRole: 'USER' | 'ADMIN';
}

export interface IWorkingHour {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface IBookingPolicies {
  minNoticeHours: number;
  maxHorizonDays: number;
  cancelCutoffHours: number;
}

export interface IBusiness {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  timezone: string;
  currency: string;
  workingHours: IWorkingHour[];
  bookingPolicies: IBookingPolicies;
  isActive: boolean;
}

export interface IMembership {
  id: string;
  role: MembershipRole;
  business: IBusiness;
}

export interface IService {
  _id: string;
  businessId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  price: number;
  qualifiedStaffIds: any[];
  isActive: boolean;
}

export interface IStaffBreak {
  start: string;
  end: string;
}

export interface IStaffDaySchedule {
  dayOfWeek: number;
  isWorking: boolean;
  shiftStart: string;
  shiftEnd: string;
  breaks: IStaffBreak[];
}

export interface IStaff {
  _id: string;
  businessId: string;
  displayName: string;
  email?: string;
  servicesOffered: any[];
  weeklySchedule: IStaffDaySchedule[];
  isActive: boolean;
}
