/**
 * @author       John Pipkin
 * @company      OpFocus
 * @date         10/21/2026
 * @description  Unit test for BitbucketTokenVendor. Mocks the Bitbucket token callout and
 *               verifies the REST endpoint relays the token JSON with a 200 status.
 */
@isTest
private class BitbucketTokenVendorTest {
    // Mock that returns a canned Bitbucket client-credentials token response.
    private class MockToken implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setHeader('Content-Type', 'application/json');
            res.setBody('{"access_token":"test-token","token_type":"bearer","expires_in":7200}');
            return res;
        }
    }
    @isTest
    static void vendsToken() {
        // Route the callout to the mock, then invoke the REST handler directly.
        Test.setMock(HttpCalloutMock.class, new MockToken());
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/opfocus/bitbucket-token';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();
        Test.startTest();
        BitbucketTokenVendor.getToken();
        Test.stopTest();
        // The endpoint should succeed and pass the token JSON through untouched.
        System.assertEquals(200, RestContext.response.statusCode);
        System.assert(RestContext.response.responseBody.toString().contains('access_token'));
    }
}
