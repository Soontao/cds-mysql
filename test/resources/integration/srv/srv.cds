namespace test.resources.integration;

using {test.resources.integration} from '../db/db';


service BankService {
  entity Details  as projection on integration.Detail;
  entity Peoples  as projection on integration.People;
  entity Cards    as projection on integration.Card;
  entity Products as projection on integration.Product;
}
