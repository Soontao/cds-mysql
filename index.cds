/**
 * support auto increment ID for cds mysql
 */
aspect incrementID {
  /**
   * Incremental ID for CDS
   */
  @cds.typeorm.config : {generated : 'increment'}
  key ID : Integer64
}
