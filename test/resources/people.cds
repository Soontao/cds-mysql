using {cuid} from '@sap/cds/common';


type Name : String(20);


entity People : cuid {
  Name : Name;
  Age  : Integer;
}
