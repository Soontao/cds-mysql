// using from '@sap/cds-mtxs/srv/model-provider'; //> IMPORTANT: don't add this as it will cause services loaded twice

@protocol: 'rest'
@(requires: [
  'cds.Subscriber',
  'internal-user'
])
@(path: '/-/cds/deployment')
service cds.xt.DeploymentService {

  /**
   * Subscribe tenant @param tenant Tenant to subscribe @param
   * options Additional subscription options
   */

  action   subscribe( @mandatory tenant : String, @open metadata : {}, @open options : {});

  /**
   * Unsubscribe tenant @param tenant Tenant to unsubscribe
   */

  action   unsubscribe( @mandatory tenant : String, @open options : {});

  /**
   * Extend tenant @param tenant Tenant to extend
   */

  action   extend( @mandatory tenant : String, @open csvs : {}); // REVISIT: csvs, better use options


  action   upgrade( @mandatory tenant : String, @open options : {});
  action   deploy( @mandatory tenant : String, @open options : {});
  // REVISIT: only needed for t0 upgrade heuristics. Can they be replaced?
  function getTables( @mandatory tenant : String)                                                returns array of String;
  function getColumns( @mandatory tenant : String, @mandatory table : String, @open params : {}) returns array of String;
  function getTenants( @open options : {})                                                       returns array of String;
  function getContainers( @open options : {})                                                    returns array of String;
}
