namespace test.resources.deep.srv;


@path: '/deep'
service DeepService {

  define entity Person {
    key ID        : Integer64;
        Name      : String(50);
        addresses : Composition of many Person.Address;
  }

  define aspect Person.Address {
    key ID  : Integer64;
    Country : String(255) default 'UK';
    City    : String(255) default 'Unknown';
  }

}
