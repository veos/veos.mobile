/*jshint browser: true, devel: true */
/*global Backbone, _, jQuery, Camera, FileTransfer, FileUploadOptions */

(function(veos) {
    var self = {};

    self.ReportForm = Backbone.View.extend({
        events: {
            'change .field': function (ev) {
                    var f = jQuery(ev.target);

                    if (f.attr('name') === 'loc_description_from_user') {
                        this.updateLocFromAddress(f.val());
                    }

                    console.log("Setting "+f.attr("name")+" to "+f.val());
                    this.model.set(f.attr('name'), f.val());
                },
            'change #unidentified-owner-checkbox': function (ev) {
                    var f = jQuery(ev.target);
                    if (f.is(':checked')) {
                        console.log("Setting owner_name and owner_description to null");
                        this.model.set('owner_name', null);
                        this.model.set('owner_description', null);
                    }
                },
            'change input[name="point-type-radio"]': function (ev) { // FIXME: ugliness
                    var type = jQuery('input[name="point-type-radio"]:checked').val();
                    
                    if (type === 'Camera') {
                        console.log("Reporting a Camera");
                        this.model.set('camera', {pointed_at: []});  
                    } else if (type == 'Sign') {
                        console.log("Reporting a Sign");
                        this.model.set('sign', {text: "I'm a sign", visibility: "can you see me?"});
                    } else {
                        console.error("Invalid report type: "+type);
                        veos.alert("Invalid report type! Must be a Camera or a Sign.");
                    }
                },
        },

        initialize: function () {
            var self = this;

            console.log("Initializing ReportForm...");

            this.model.on('change', _.bind(this.updateChangedFields, this));

            this.$el.find('#cancel-report').click(function () {
                console.log("Cancelling report...");
                self.clear();
                delete veos.reportForm;
                delete veos.currentReport;
                return true;
            });

            this.$el.find('#submit-report').click(function () {
                console.log("Saving report...");
                self.model.save(null, {
                    success: function () {
                        delete veos.currentReport;
                        veos.alert("Report submitted successfully!");
                        jQuery.mobile.changePage("overview-map.html");
                    }
                });
            });

            this.$el.data('initialized', true); // check this later to prevent double-init

            jQuery(document).delegate("#refine-location-submit", "click", function () {
                console.log("User submitted refined location")
                return true;
            });
        },

        clear: function () {
            console.log("Clearing ReportForm...");

            this.model = new veos.model.Report();
            this.render();

            // FIXME: bad!
            veos.currentReport = this.model;
        },

        updateLocFields: function () {
            var self = this;
            var geoloc;
            if (this.model.getLatLng()) {
                console.log("Using location from report model...", this.model.getLatLng());
                geoloc = this.model.getLatLng();
            } else if (veos.lastLoc) {
                console.log("Using last known location...", veos.latLoc);
                geoloc = veos.lastLoc;
            } else {
                console.warn("Location unavailable... cannot update fields that depend on location.")
                return;
            }

            this.updateMapThumbnailFromLoc(geoloc);
            this.updateAddressFromLoc(geoloc);
        },

        updateMapThumbnailFromLoc: function (geoloc) {
            var glatlng = veos.map.convertGeolocToGmapLatLng(geoloc);
            var staticMapURL = veos.map.generateStaticMapURL(glatlng);
            var mapThumbnail = jQuery(this.$el.find('.map-thumbnail'));
            mapThumbnail.attr('src', staticMapURL);
            jQuery(".map-thumbnail-container .waiting").hide();
        },

        updateAddressFromLoc: function (geoloc) {
            var self = this;
            veos.map.lookupAddressForLoc(geoloc, function (address) {
                self.model.set('loc_description_from_google', address.formatted_address);
                self.model.set('loc_description_from_user', address.formatted_address);
            });
        },

        updateLocFromAddress: function (address) {
            var self = this;
            veos.map.lookupLocForAddress(address, function (lat, lng) {
                self.model.set('loc_lat_from_user', lat);
                self.model.set('loc_lng_from_user', lng);
                self.updateMapThumbnailFromLoc(new google.maps.LatLng(lat, lng));
            });
        },

        updateChangedFields: function () {
            console.log("updating changed fields in ReportForm!");
            var self = this;
            _.each(this.model.changed, function(v, k) {
                self.$el.find('*[name="'+k+'"].field').val(self.model.get(k));
            });

            // TODO: handle other non-trivial fields like report type, photo, etc.
        },

        /**
            Triggers full update of all dynamic elements in the report page.
        **/
        render: function () {
            console.log("rendering ReportForm!");
            var self = this;
            _.each(this.model.attributes, function(v, k) {
                self.$el.find('.field[name="'+k+'"]').val(self.model.get(k));
            });
            self.updateLocFields();
        },

        renderPhoto: function (photo) {
            console.log(photo);
            console.log("Rendering photo from URL: " + photo.imageURL);

            // create empty image element
            var cameraImage = jQuery('<img />');
            // set image URI of image element
            cameraImage.attr('src', photo.imageURL);
            cameraImage.data('photo', photo);
            
            // select div that will hold all image elements added
            var imageList = jQuery('#image-list');
            // only one image
            imageList.empty();

            // add newly created image to image list
            imageList.append(cameraImage);
        }
    });

    veos.view = self;
})(window.veos);