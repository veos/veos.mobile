/*jshint browser: true, devel: true */
/*global Backbone, _, jQuery, Camera, FileTransfer, FileUploadOptions, google */

(function(veos) {
    var self = {};

    var addLoader = function (container) {
        var loader = jQuery("<div class='loading'><img src='images/loading-64.gif' alt='Loading...' /><p>Loading...</p></div>");
        jQuery(container).append(loader);
        return loader;
    };

    /**
        ReportForm
        Wires report.html for editing a Report object.
    **/
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

            'click #submit-report': 'submit',
            'click #cancel-report': 'cancel'
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

        submit: function () {
            var self = this;

            self.model.save(null, {
                success: function () {
                    console.log("Report saved successfully with id "+self.model.id);
                    
                    //var photos = self.$el.find('img.photo');
                    var photos = self.photos;

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
                console.log("User submitted refined location");
                return true;
            });
        },

        cancel: function () {
            console.log("Cancelling report...");
            this.clear();
            delete veos.reportForm;
            delete veos.currentReport;
            return true; // will now redirect to clicked element's href
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
                console.warn("Location unavailable... cannot update fields that depend on location.");
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
            console.log("updating changed fields in ReportForm: "+_.keys(this.model.changed).join(", "));
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


    /**
        ReportList
        Shows a list of Reports.
    **/
    self.ReportList = Backbone.View.extend({
        MAX_DISTANCE_FROM_CURRENT_LOCATION: 10, // km

        initialize: function () {
            var self = this;

            if (!this.collection)
                this.collection = new veos.model.Reports();

            // TODO: consider binding 'add' and 'remove' to pick up added/removed Reports too?
            this.collection.on('reset', _.bind(this.render, this)); 
        },

        fetchNearby: function () {
            var list = this.$el.find('.reports-list');
            addLoader(list);
            this.collection.fetch();
        },

        render: function () {
            var list = this.$el.find('.reports-list');
            list.empty();

            this.collection.each(function (report) {
                var buttonText = '';

                // creates the HTML for the jQuery button to be filled with returned content. Why are you so ugly jQuery?
                if (report.get('sign')) {
                    buttonText =  "Sign @ " + report.get('owner_name') + "<br/>" + report.getLocDescription();
                } else if (report.get('camera')) {
                    buttonText = "Camera @ " + report.get('owner_name') + "<br/>" + report.getLocDescription();
                }
                
                var divA = jQuery('<div class="ui-block-a">');
                var reportOuterButton = jQuery('<a href="report-details.html?id='+report.id+'" data-role="button" data-transition="fade" href="#point-details-page" data-icon="arrow-r" data-iconpos="left" data-theme="c" class="ui-btn ui-btn-icon-left ui-btn-corner-all ui-shadow ui-btn-up-c" />');
                reportOuterButton.button();
                // attaching the report object to the HTML in data-report
                reportOuterButton.data('report', report);
                var reportInnerButton = jQuery('<span class="ui-btn-inner ui-btn-corner-all">' + buttonText + '</span>');
                var reportButtonIcon = jQuery('<span class="ui-icon ui-icon-arrow-r ui-icon-shadow" />');
                reportOuterButton.append(reportInnerButton);
                reportOuterButton.append(reportButtonIcon);
                divA.append(reportOuterButton);
                //reportInnerButton.text(report.get('location_name') + &#10; + report.get('latitude'));
                list.append(divA);
            });
        }
    });

    /**
        ReportDetail
        Shows detailed information about a report.
    **/
    self.ReportDetail = Backbone.View.extend({
        initialize: function () {
            var self = this;

            // TODO: consider binding 'add' and 'remove' to pick up added/removed Reports too?
            this.model.on('change sync', _.bind(this.render, this)); 
        },

        showLoader: function () {
            this.loader = addLoader(this.$el.find('[role="content"]'));
            // FIXME: this looks ugly
            this.loader.css({
                position: 'absolute',
                top: '30%',
                width: '100%'
            });
        },

        hideLoader: function () {
            this.loader.remove();
            delete this.loader;
        },

        render: function () {
            var report = this.model;

            if (this.loader)
                this.hideLoader();
            
            var photoThumbnail = jQuery('<img class="photo-thumbnail" />');
            var photoContainer = this.$el.find('.photo-thumbnail-container');

            this.$el.find('.installation-title').text('Eaton Centre');

            // TODO: replace with Matt's stuff
            /*    var photoThumbnail = jQuery('<img class="photo-thumbnail" />');
            photoThumbnail.attr('src', I'M GOING TO BE A PHOTO);
            var photoContainer = jQuery('#point-details-page .photo-thumbnail-container');
            photoContainer.append(photoThumbnail); */ 

            if (report.get('camera')) {
                if (report.get('camera').hasOwnProperty("photos") && report.get('camera').photos.length > 0 && report.get('camera').photos[0].url !== null) {
                    photoThumbnail.attr('src', veos.model.baseURL + report.get('camera').photos[0].url);
                }
                this.$el.find('.point-type').text('Camera');
                this.$el.find('.point-title-1').text('Camera\'s location: ');
                this.$el.find('.point-content-1').text(report.attributes.loc_description_from_google);
                this.$el.find('.point-title-2').text('Owner name: ');
                this.$el.find('.point-content-2').text(report.attributes.owner_name);
                this.$el.find('.point-title-3').text('Owner description: ');
                this.$el.find('.point-content-3').text(report.attributes.owner_description);
            } else if (report.get('sign')) {
                if (report.get('sign').hasOwnProperty("photos") && report.get('sign').photos.length > 0 && report.get('sign').photos[0].url !== null) {
                    photoThumbnail.attr('src', veos.model.baseURL + report.get('sign').photos[0].url);
                }
                this.$el.find('.point-type').text('Sign');
                this.$el.find('.point-title-1').text('Sign location: ');
                this.$el.find('.point-content-1').text(report.attributes.loc_description_from_google);
                this.$el.find('.point-title-2').text('Owner name: ');
                this.$el.find('.point-content-2').text(report.attributes.owner_name);
                this.$el.find('.point-title-3').text('Owner description: ');
                this.$el.find('.point-content-3').text(report.attributes.owner_description);
                this.$el.find('.point-title-4').text('Visibility of sign: ');
                this.$el.find('.point-content-4').text(report.get('sign').visibility);
                this.$el.find('.point-title-5').text('Text of Sign: ');
                this.$el.find('.point-content-5').text(report.get('sign').text);
                /*jQuery('#point-details-page .point-title-1').text('Visibility: ');
                jQuery('#point-details-page .point-content-1').text('Obscure/High');
                jQuery('#point-details-page .point-title-2').text('Stated Purpose: ');
                jQuery('#point-details-page .point-content-2').text('Public Safety');*/
                this.$el.find('.point-content-4').append(jQuery('<br />'));
            } else {
                console.log ('neither a camera or a sign');
            }
            photoContainer.append(photoThumbnail);
        }
    });


    veos.view = self;
})(window.veos);