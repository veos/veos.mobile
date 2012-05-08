/*jshint browser: true, devel: true */

window.veos = (function(veos) {
    var self = veos;           

    self.alert = function (msg, title) {
        if (navigator === undefined || navigator.notification === undefined) {
            alert(msg);
        } else {
            navigator.notification.alert(msg, null, title);
        }
    }

    /**
        Initializes the whole app. This needs to be called at the bottom of every VEOS page.
    **/
    self.init = function () {

        jQuery(document)

            /** overview-map.html (overview-map-page) **/
            .delegate("#overview-map-page", "pageinit", function() {
                var map = new veos.map.Map('#overview-map-canvas');

                // add all report markers
                var reports = new veos.model.Reports();
                reports.on('reset', function(collection) {
                    map.addReportMarkers(collection);
                });
                reports.fetch();

                // start following user
                map.startFollowing();
            })

            /** report.html (report-page) **/
            .delegate("#report-page", "pageinit", function() {
                jQuery('#cancel-report').click(function() {
                    document.location="overview-map.html";
                });
                jQuery('#location-address').change(function() {
                    console.log('change in the address box');
                    veos.alert('Address change successful');
                    //window.veos.map.testFunction();
                    window.report.lookupLatLngForAddress(jQuery('#location-address').val());
                });
                jQuery('#submit-report').click(function() {
                    console.log('submitting report...');
                    window.report.submitReport();
                });

                jQuery('#unidentified-owner-checkbox').click( function() {
                    if (jQuery('#unidentified-owner-checkbox').attr("checked")) {
                        jQuery('#owner').val('');
                        jQuery('#owner').attr('disabled', true);
                    } else {
                        jQuery('#owner').removeAttr('disabled');    
                    }
                });

                // this needs to go in here to make the refined map work, I believe. But it may also be causing the wierd viewport issues
                report.init();
            });
    }

    return self;
})(window.veos || {});
