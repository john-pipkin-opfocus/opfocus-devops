/**
 * @author       John Pipkin
 * @company      OpFocus
 * @date         10/22/2026
 * @description  Supplies the current user's pending deployment reviews to the
 *               "Deployments awaiting your review" Home-page Lightning component.
 */
public with sharing class DeploymentReviewController {
    /**
     * @description Pending deployments for which the running user is the Reviewer.
     * @return      Deployment__c records awaiting the current user's approval.
     */
    @AuraEnabled(cacheable=true)
    public static List<Deployment__c> getMyPendingReviews() {
        return [
            SELECT Id, Name, Branch__c, Status__c, CreatedDate, CreatedBy.Name
            FROM Deployment__c
            WHERE Approval_Status__c = 'Pending'
              AND Reviewer__c = :UserInfo.getUserId()
            ORDER BY CreatedDate DESC
            LIMIT 200
        ];
    }
}
