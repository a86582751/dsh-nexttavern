export type MvuJsonValue = null | boolean | number | string | MvuJsonValue[] | MvuJsonObject
export interface MvuJsonObject { [key: string]: MvuJsonValue }
