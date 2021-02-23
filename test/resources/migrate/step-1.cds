namespace test.resources.migrate;

using {cuid} from '@sap/cds/common';

entity People : cuid {
  Name : String(100);
}
