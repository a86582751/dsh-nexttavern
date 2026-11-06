/** Command diagnostic DATA shared by the current V4 executor. */
export type MvuSchemaDiagnosticV2=
  | {code:'SCHEMA_VALIDATION_FAILED';registrationIndex:number}
  | {code:'SCHEMA_VALIDATION_FAILED';commandIndex:number;failedRegistrationIndexes:readonly number[]}
  | {code:'SCHEMA_UPDATE_OPERATION_REJECTED';commandIndex:number;registrationIndex:number;
      updateCode:string;pointer?:string}
