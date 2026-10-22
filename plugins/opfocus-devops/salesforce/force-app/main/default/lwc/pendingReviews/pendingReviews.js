/**
 * @author       John Pipkin
 * @company      OpFocus
 * @date         10/22/2026
 * @description  Home-page component listing the deployments awaiting the
 *               current user's review (Approval Status = Pending, Reviewer = me).
 */
import { LightningElement, wire } from 'lwc';
import getMyPendingReviews from '@salesforce/apex/DeploymentReviewController.getMyPendingReviews';

export default class PendingReviews extends LightningElement {
    rows = [];
    error;

    @wire(getMyPendingReviews)
    wired({ data, error }) {
        if (data) {
            this.rows = data.map((d) => ({
                id: d.Id,
                name: d.Name,
                url: `/${d.Id}`,
                branch: d.Branch__c,
                submittedBy: d.CreatedBy ? d.CreatedBy.Name : '',
                project: d.Project__r ? d.Project__r.Name : ''
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.rows = [];
        }
    }

    get hasRows() {
        return this.rows.length > 0;
    }
    get count() {
        return this.rows.length;
    }
}
