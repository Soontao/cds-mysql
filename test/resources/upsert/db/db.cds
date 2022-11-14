namespace test.upsert;

using {cuid} from '@sap/cds/common';

entity Product : cuid {
  Name : String(255);
}
