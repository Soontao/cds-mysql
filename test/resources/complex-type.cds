using {cuid} from '@sap/cds/common';


type Name : {
  First : String(100);
  Last  : String(200);
};


entity User1 : cuid {
  Name : Name;
}
