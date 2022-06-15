namespace test.resources.deep.srv;

using {
  cuid,
  managed
} from '@sap/cds/common';


@path : '/deep'
service DeepService {

  define entity Person : managed {
    key ID        : Integer64;
        Name      : String(20);
        addresses : Composition of many Person.Address;
  }

  define aspect Person.Address : managed {
    key ID  : Integer64;
    Country : String(255);
    City    : String(255);
  }

}
