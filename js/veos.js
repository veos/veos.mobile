/*jshint browser: true, devel: true */
/*globals jQuery */

window.veos = (function(veos) {
    var self = veos;

    // the last acquired user location is cached here
    self.lastLoc = new google.maps.LatLng(43.6621614579938, -79.39527873417967); // FIXME: default hard-coded to toronto; maybe make it based on last report?

    self.alert = function (msg, title) {
        if (navigator === undefined || navigator.notification === undefined) {
            alert(msg);
        } else {
            navigator.notification.alert(msg, null, title);
        }
    };

    /**
        Initializes the whole app. This needs to be called at the bottom of every VEOS page.
    **/
    self.init = function () {
        // FIXME: hacky... needs to be here for proper phongep init :(
        document.addEventListener('deviceready', function() {
            console.log("DEVICE READY!!!!");
            jQuery(document).delegate('.acquire-photo', 'click', function() {
                var photo = new veos.model.Photo();

                var captureSuccess = function () {
                    veos.reportForm.renderPhoto(photo);
                    photo.upload();
                };

                photo.on('image_capture', captureSuccess, photo);
                
                switch (jQuery(this).data('acquire-from')) {
                    case 'camera':
                        photo.captureFromCamera();
                        break;
                    case 'gallery':
                        photo.captureFromGallery();
                        break;
                    default:
                        console.error("'"+jQuery(this).data('acquire-from')+"' is not a valid source for acquiring a photo.");
                }
            });
        });


        jQuery(self).bind('haveloc', function (ev, geoloc) {
            console.log("Got updated gps location: ", geoloc);
            self.lastLoc = geoloc;
        });

        jQuery(document)

        /** overview-map.html (overview-map-page) **/
            .delegate("#overview-map-page", "pageshow", function() {
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
            .delegate("#report-page", "pageshow", function(ev) {
                if (!self.currentReport) {
                    self.currentReport = new veos.model.Report();
                }

                if (!self.reportForm || !jQuery(ev.target).data('initialized')) {
                    self.reportForm = new veos.view.ReportForm({
                        el: ev.target,
                        model: self.currentReport
                    });
                }
                
                self.reportForm.render();

                jQuery('#unidentified-owner-checkbox').click( function() {
                    if (jQuery('#unidentified-owner-checkbox').attr("checked")) {
                        jQuery('#owner').val('');
                        jQuery('#owner').attr('disabled', true);
                    } else {
                        jQuery('#owner').removeAttr('disabled');    
                    }
                });

                // this needs to go in here to make the refined map work, I believe. But it may also be causing the wierd viewport issues
                //report.init();
            })
    
        /** refine-location.html (refine-location-page) **/
            .delegate("#refine-location-page", "pageshow", function() {
                if (!veos.reportForm) {
                    console.error("Cannot refine location because there is no report currently in progress.");
                    jQuery.mobile.changePage("report.html");
                    return
                }
                
                
                var map = new veos.map.Map('#refine-location-canvas');
                map.addReportRefinerMarker(self.reportForm.model, veos.lastLoc);
                

                

                // start following user
                // map.startFollowing();
            })

        /** installations.html (installations-page) **/
            .delegate("#installations-page", "pageshow", function() {
                installations.init();
                

                // start following user
                // map.startFollowing();
            });
    };

    return self;
})(window.veos || {});
