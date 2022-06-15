namespace test.resources.deep.srv;


@path : '/deep'
service DeepService {

  define entity Person {
    key ID        : Integer64;
        Name      : String(20);
        addresses : Composition of many Person.Address;
  }

  define aspect Person.Address {
    key ID  : Integer64;
    Country : String(255);
    City    : String(255);
  }

}
