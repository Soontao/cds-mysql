namespace test.upsert;

using {test.upsert} from '../db/db';

@requires : 'authenticated-user'
service DemoService {
  entity Products as projection on upsert.Product;
  action Upsert(ID : UUID, Name : String) returns Products;
}
