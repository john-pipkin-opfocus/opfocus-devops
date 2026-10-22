/**
 * @author       John Pipkin
 * @company      OpFocus
 * @date         10/22/2026
 * @description  Tests DeploymentReviewController.getMyPendingReviews.
 */
@isTest
private class DeploymentReviewControllerTest {
    /**
     * @description A Pending deployment with the running user as Reviewer is returned;
     *              one assigned to someone else is not.
     */
    @isTest
    static void returnsOnlyMyPendingReviews() {
        Id me = UserInfo.getUserId();

        Deployment__c mine = new Deployment__c(
            Status__c = 'Validated', Approval_Status__c = 'Pending',
            Reviewer__c = me, Branch__c = 'stage');
        Deployment__c notMine = new Deployment__c(
            Status__c = 'Validated', Approval_Status__c = 'Pending',
            Branch__c = 'stage');
        insert new List<Deployment__c>{ mine, notMine };

        Test.startTest();
        List<Deployment__c> results = DeploymentReviewController.getMyPendingReviews();
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Only the running user\'s pending review should return');
        System.assertEquals(mine.Id, results[0].Id, 'Wrong record returned');
    }
}
