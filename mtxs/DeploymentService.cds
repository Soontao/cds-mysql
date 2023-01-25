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

                      @open
  action   subscribe( @mandatory tenant : String, metadata : {}, options : {});

  /**
   * Unsubscribe tenant @param tenant Tenant to unsubscribe
   */

                        @open
  action   unsubscribe( @mandatory tenant : String, options : {});

  /**
   * Extend tenant @param tenant Tenant to extend
   */

                   @open
  action   extend( @mandatory tenant : String);

                    @open
  action   upgrade( @mandatory tenant : String, options : {});

                   @open
  action   deploy( @mandatory tenant : String, options : {});

  // REVISIT: Do we need this for job orchstration via CLI use?
  //action updateAll(options:{});

  function getTables( @mandatory tenant : String)                                 returns array of String;
  function getColumns(  @mandatory  tenant : String,  @mandatory  table : String) returns array of String;
}
