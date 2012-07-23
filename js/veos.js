/*jshint browser: true, devel: true */
/*globals jQuery, google */

window.veos = (function(veos) {
    var self = veos;

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
        if (window.location.pathname == "/") {
            console.log("Redirecting to /overview-map.html");
            window.location.href = "/overview-map.html";
            return;
        }

        document.addEventListener('deviceready', function() {
            console.log("PhoneGap: DEVICE READY!!!!");
            self.initPhonegapStuff();
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

                    if (veos.lastLoc) {
                        var initLoc = veos.map.convertGeolocToGmapLatLng(veos.lastLoc);
                        self.currentReport.set('loc_lng_from_gps', initLoc.lng());
                        self.currentReport.set('loc_lat_from_gps', initLoc.lat());
                    }
                }

                if (!self.reportForm) {
                    self.reportForm = new veos.view.ReportForm({
                        el: ev.target,
                        model: self.currentReport
                    });
                }

                if (!self.reportForm.$el.data('initialized')) {
                    console.log("Pointing ReportForm to "+ev.target);
                    self.reportForm.setElement(ev.target);
                    self.reportForm.$el.data('initialized', true);
                }
                
                self.reportForm.render();

                // this needs to go in here to make the refined map work, I believe. But it may also be causing the wierd viewport issues
                //report.init();
            })
    
        /** refine-location.html (refine-location-page) **/
            .delegate("#refine-location-page", "pageshow", function() {
                if (!veos.reportForm) {
                    console.error("Cannot refine location because there is no report currently in progress.");
                    jQuery.mobile.changePage("report.html");
                    return;
                }
                
                var map = new veos.map.Map('#refine-location-canvas');
                map.addReportRefinerMarker(self.reportForm.model, veos.lastLoc);
            })


        /** installations-list.html (installations-list-page) **/
            .delegate("#installations-list-page", "pageshow", function(ev) {
                var installations = new veos.model.Installations();

                var view = new veos.view.InstallationList({
                    el: ev.target,
                    collection: installations
                });
                
                installations.fetch();
            })              

        /** report-selection.html (report-selection-page) **/
            .delegate("#report-selection-page", "pageshow", function(ev) {
                var nearbyInstallations = new veos.model.NearbyInstallations(self.lastLoc.coords.latitude, self.lastLoc.coords.longitude, 10);           // TODO I'm pretty sure this is not the right way to access these

                var view = new veos.view.InstallationList({
                    el: ev.target,
                    collection: nearbyInstallations
                });
                
                nearbyInstallations.fetch();
            })

        /** installation-details.html (installation-details-page) **/
            .delegate("#installation-details-page", "pageshow", function(ev) {
                console.log("Showing details page at "+window.location.href);
                var installationId = window.location.href.match("[\\?&]id=(\\d+)")[1];
                console.log("Showing details for installation "+installationId);

                var installation = new veos.model.Installation({id: installationId});

                var view = new veos.view.InstallationDetail({
                    el: ev.target,
                    model: installation
                });
                
                view.showLoader();  
                view.model.fetch();             // I don't think this is right - the whole 'view doesn't call this stuff on itself' (should be moved to the init in view?)
            })




        /** reports-list.html (reports-list-page) LEGACY CODE **/
            .delegate("#reports-list-page", "pageshow", function(ev) {
                var view = new veos.view.ReportList({
                    el: ev.target
                });
                
                view.fetchNearby();
            })
        /** report-details.html (report-details-page)  LEGACY CODE **/
            .delegate("#report-details-page", "pageshow", function(ev) {
                console.log("Showing details page at "+window.location.href);
                var reportId = window.location.href.match("[\\?&]id=(\\d+)")[1];
                console.log("Showing details for report "+reportId);

                var report = new veos.model.Report({id: reportId});

                var view = new veos.view.ReportDetail({
                    el: ev.target,
                    model: report
                });
                
                view.showLoader();
                view.model.fetch();
            });

            
    };

    self.initPhonegapStuff = function () {
        veos.captureImage = function (from, photo) {
            var captureSuccess = function () {
                console.log("Acquired photo.");
                photo.upload();
            };

            photo.on('image_capture', captureSuccess, photo);
            
            switch (from) {
                case 'camera':
                    photo.captureFromCamera();
                    break;
                case 'gallery':
                    photo.captureFromGallery();
                    break;
                default:
                    console.error("'"+from+"' is not a valid source for acquiring a photo.");
            }
        };
    };

    return self;
})(window.veos || {});
