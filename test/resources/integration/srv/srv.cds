namespace test.resources.integration;

using {test.resources.integration} from '../db/db';


service BankService {
  entity Peoples as projection on integration.People;
  entity Cards   as projection on integration.Card;
}
