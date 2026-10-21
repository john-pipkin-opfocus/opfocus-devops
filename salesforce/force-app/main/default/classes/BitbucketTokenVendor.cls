/**
 * @author       John Pipkin
 * @company      OpFocus
 * @date         10/21/2026
 * @description  Vends a short-lived Bitbucket access token to an authenticated, permissioned
 *               caller. The OAuth consumer key/secret live only in the Bitbucket_Token_Vendor
 *               named credential (non-retrievable); this class makes the client-credentials
 *               call through it and returns only the short-lived token. Gated by Apex class
 *               access on the OpFocus_DevOps_User permission set.
 */
@RestResource(urlMapping='/opfocus/bitbucket-token')
global with sharing class BitbucketTokenVendor {
    @HttpGet
    global static void getToken() {
        // Build the client-credentials token request; the named credential injects Basic auth
        // from the stored consumer key/secret, so the secret never enters this Apex context.
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:Bitbucket_Token_Vendor/site/oauth2/access_token');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
        req.setBody('grant_type=client_credentials');
        req.setTimeout(20000);
        // Call Bitbucket and relay the short-lived token JSON straight back to the caller.
        HttpResponse res = new Http().send(req);
        RestContext.response.statusCode = res.getStatusCode();
        RestContext.response.addHeader('Content-Type', 'application/json');
        RestContext.response.responseBody = Blob.valueOf(res.getBody());
    }
}
