/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true */
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
      // for most fields
      'change .field': function (ev) {
        var f = jQuery(ev.target);

        if (f.attr('name') === 'loc_description_from_user') {
          this.updateLocFromAddress(f.val());
        }

        console.log("Setting "+f.attr("name")+" to "+f.val());
        this.model.set(f.attr('name'), f.val());
      },
      // for multipickers
      'change .multi-field': function (ev) {
        var f = jQuery(ev.target);

        // this.model.removeTags()          // TODO when backend functionality is there
        var frozenModel = this.model;                     // 'this' changes inside the each
        _.each(f.val(), function(el) {
          frozenModel.addTag(el, f.attr('name'));
          console.log("Setting "+f.attr("name")+" to "+el);
        });
      },

      // specific to owner_name
      'change [name="owner_name"].field': function (ev) {
        var f = jQuery(ev.target);

        var unidentified_owner_input = this.$el.find("#unidentified-owner-checkbox").parent();
        if (f.val() === "") {
          unidentified_owner_input.css('opacity', 1.0);
        } else {
          unidentified_owner_input.css('opacity', 0.4);
          this.model.set('owner_identifiable', true);
        }
      },
      'change #unidentified-owner-checkbox': function (ev) {
        var f = jQuery(ev.target);
        f.parent().css('opacity', 1.0);
        if (f.is(':checked')) {
          console.log("Setting owner_name and owner_type to null");
          this.model.set('owner_name', null);
          this.model.set('owner_type', null);
          this.model.set('owner_identifiable', false);
          this.$el.find('#owner').attr('disabled', true);
        } else {
          this.$el.find('#owner').removeAttr('disabled');
          this.model.set('owner_identifiable', true);
        }
      },          
      'change #sign-yes': function (ev) {
        console.log('sign-yes button clicked');
        jQuery('#sign-details-container').trigger('expand');
        this.model.set('has_sign', true);
      },  
      'change #sign-no': function (ev) {
        console.log('sign-no button clicked');
        jQuery('#sign-details-container').trigger('collapse');
        this.model.set('has_sign', false);
      },

      // 'click .acquire-photo': function (ev) {
      //     var from = jQuery(ev.target).data('acquire-from');
      //     veos.currentPhoto = new veos.model.Photo();
      //     new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
      //     veos.captureImage(from, veos.currentPhoto);
      // }, 

      'click #add-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
        veos.captureImage('camera', veos.currentPhoto);
      }, 

      'click #select-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
        veos.captureImage('gallery', veos.currentPhoto);
      },


      'click #submit-report': 'submit',
      'click #cancel-report': 'cancel'
    },

    initialize: function () {
      //var self = this;
      console.log("Initializing ReportForm...");

      this.model.on('change', _.bind(this.updateChangedFields, this));

      this.$el.data('initialized', true); // check this later to prevent double-init

      // FIXME: this is kind of nasty... refine-location should get its own View to make this better
      jQuery(document).delegate("#refine-location-submit", "click", function () {
        console.log("User submitted refined location");
        veos.currentReport.set('loc_description_from_user', null); // we'll look it up again from geoloc
        return true; // will now redirect to clicked element's href
      });
    },

    submit: function () {
      var self = this;

      jQuery.mobile.showPageLoadingMsg();
      jQuery('.ui-loader h1').text('Submitting...');
      // use this once we upgrade to jQuery Mobile 1.2
      //jQuery.mobile.loading( 'show', { theme: "b", text: "Submitting...", textonly: false });

      self.model.save(null, {
        complete: function () {
          jQuery.mobile.hidePageLoadingMsg();
        },
        success: function () {
          var report = self.model;    
          var successCounter = 0;     // needed to know when we went through all the attached pictures
          
          console.log("Report saved successfully with id "+report.id);
          
          // This function is called later on in the success once all is done
          // deletes objects and bounces us back to overview map
          var doneSubmit = function() {
            delete veos.currentReport;
            delete veos.reportForm;
            veos.alert("Report submitted successfully!");
            jQuery.mobile.changePage("overview-map.html");
          };
          
          var images = jQuery('.photo-list-item');    // get all images that were taken
          var photoCount = images.length;             // count how many pictures are attached
          console.log("Total count of photos attached: " +photoCount);

          // no photos attached so we are done (call doneSubmit)
          if (photoCount === 0) {
            console.log("No pictures and we are done!");
            doneSubmit();
            return;
          }
          
          // go through all pictures and attach them to the report
          jQuery('.photo-list-item').each(function (idx) {
            // retrieving photo model data stored in DOM as JSON
            var photoModelJson = jQuery(this).attr('data-model');
            console.log('Photo Model JSON: ' +photoModelJson);
            var photoModel = JSON.parse(photoModelJson);

            // create a Photo model using the id
            var photo = new veos.model.Photo({id: photoModel.photo.id});

            // once photo model is available (via fetch) we attach the photo to the report
            var photoFetchSuccess = function (model, response) {
              console.log("We made it and are about tot attach Photos");

              report.attachPhoto(model, function () {
                successCounter++;
                if (successCounter === photoCount) {
                  console.log("All photos attached!");
                  doneSubmit();
                  return;
                }
              });
            };

            // TODO: think about this since it delets all input on error and returns to map
            function photoFetchError (model, response) {
              console.error("Fetching photo model " + model.id +" failed with error: " +response);
              veos.alert("Error fetching Photo data during Report submission!");
              delete veos.currentReport;
              delete veos.reportForm;
              jQuery.mobile.changePage("overview-map.html");
            }

            photo.fetch({success: photoFetchSuccess, error: photoFetchError});
          });
        }
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

      // TODO: need to clear photos and stuff

      this.model = new veos.model.Report();
      this.render();

      // FIXME: bad!
      veos.currentReport = this.model;
    },

    updateLocFields: function () {
      //var self = this;
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
        // only set user address from location if user hasn't manually entered it
        if (!self.model.get('loc_description_from_user')) {
          self.model.set('loc_description_from_user', address.formatted_address);
        }
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
      //self.renderPhotos();
    }

    // renderPhotos: function () {
    //     var photos = this.$el.find('#photos');
    //     //photos.text(JSON.stringify(this.model.toJSON(), null, 2));
    //     //photos.append("<br />");
    //     // _.each(this.model.getPhotos(), function (photo) {
    //     //     console.log("Photo url: "+photo.thumbUrl());
    //     //     photos.append("<img src='"+photo.thumbUrl()+"' />")
    //     // });

    //     console.log("In renderPhotos")
    //     _.each(this.model.getPhotos(), function (photo) {
    //         if (this.$el.find('#photo-'+photo.id).length === 0) {
    //           var img = this.make('img', {src: photo.get('thumb_url')});
    //           photos.append(img);
    //         }
    //     });
    // }
  });




















  // this really should be an extension ofthe ReportForm view above


  self.ReportEditForm = Backbone.View.extend({
    events: {
      // for most fields
      'change .field': function (ev) {
        var f = jQuery(ev.target);

        if (f.attr('name') === 'loc_description_from_user') {
          this.updateLocFromAddress(f.val());
        }

        console.log("Setting "+f.attr("name")+" to "+f.val());
        this.model.set(f.attr('name'), f.val());
      },
      // for multipickers
      'change .multi-field': function (ev) {
        var f = jQuery(ev.target);

        // this.model.removeTags()          // TODO when backend functionality is there
        var frozenModel = this.model;                     // 'this' changes inside the each
        _.each(f.val(), function(el) {
          frozenModel.addTag(el, f.attr('name'));
          console.log("Setting "+f.attr("name")+" to "+el);
        });
      },

      // specific to owner_name
      'change [name="owner_name"].field': function (ev) {
        var f = jQuery(ev.target);

        var unidentified_owner_input = this.$el.find("#unidentified-owner-checkbox").parent();
        if (f.val() === "") {
          unidentified_owner_input.css('opacity', 1.0);
        } else {
          unidentified_owner_input.css('opacity', 0.4);
          this.model.set('owner_identifiable', true);
        }
      },
      'change #unidentified-owner-checkbox': function (ev) {
        var f = jQuery(ev.target);
        f.parent().css('opacity', 1.0);
        if (f.is(':checked')) {
          console.log("Setting owner_name and owner_type to null");
          this.model.set('owner_name', null);
          this.model.set('owner_type', null);
          this.model.set('owner_identifiable', false);
          this.$el.find('#owner').attr('disabled', true);
        } else {
          this.$el.find('#owner').removeAttr('disabled');
          this.model.set('owner_identifiable', true);
        }
      },          
      'change #sign-yes': function (ev) {
        console.log('sign-yes button clicked');
        jQuery('#sign-details-container').trigger('expand');
        this.model.set('has_sign', true);
      },  
      'change #sign-no': function (ev) {
        console.log('sign-no button clicked');
        jQuery('#sign-details-container').trigger('collapse');
        this.model.set('has_sign', false);
      },
      'click #add-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
        veos.captureImage('camera', veos.currentPhoto);
      }, 

      'click #select-camera-photo-button': function (ev) {
        //var from = jQuery(ev.target).data('acquire-from');
        veos.currentPhoto = new veos.model.Photo();
        new PhotoView({model: veos.currentPhoto, el: this.$el.find('#photos')});
        veos.captureImage('gallery', veos.currentPhoto);
      },


      'click #submit-report': 'submit',
      'click #cancel-report': 'cancel'
    },

    initialize: function () {
      //var self = this;
      console.log("Initializing ReportForm...");

      this.model.on('change', _.bind(this.updateChangedFields, this));

      this.$el.data('initialized', true); // check this later to prevent double-init

      // FIXME: this is kind of nasty... refine-location should get its own View to make this better
      jQuery(document).delegate("#refine-location-submit", "click", function () {
        console.log("User submitted refined location");
        veos.currentReport.set('loc_description_from_user', null); // we'll look it up again from geoloc
        return true; // will now redirect to clicked element's href
      });
    },

    submit: function () {
      var self = this;

      jQuery.mobile.showPageLoadingMsg();
      jQuery('.ui-loader h1').text('Submitting...');
      // use this once we upgrade to jQuery Mobile 1.2
      //jQuery.mobile.loading( 'show', { theme: "b", text: "Submitting...", textonly: false });

      self.model.save(null, {
        complete: function () {
          jQuery.mobile.hidePageLoadingMsg();
        },
        success: function () {
          console.log("Report saved successfully with id "+self.model.id);
          
          var doneSubmit = function() {
            delete veos.currentReport;
            delete veos.reportForm;
            delete veos.currentInstallation;        // unique to editReport's view

            veos.alert("Report submitted successfully!");
            jQuery.mobile.changePage("overview-map.html");
          };

          var report = self.model;
          var successCounter = 0;
          //var photoTotalCount = self.model.getPhotos().length;

          var images = jQuery('.photo-list-item');
          var photoCount = images.length;
          console.log("Total count of photos attached: " +photoCount);

          if (photoCount === 0) {
            console.log("No pictures and we are done!");
            doneSubmit();
            return;
          }
          
          jQuery('.photo-list-item').each(function (idx) {
            // retrieving photo model data stored in DOM as JSON
            var photoModelJson = jQuery(this).attr('data-model');
            console.log('Photo Model JSON: ' +photoModelJson);
            var photoModel = JSON.parse(photoModelJson);

            // create a Photo model using the id
            var photo = new veos.model.Photo({id: photoModel.photo.id});

            // once photo model is available (via fetch) we attach the photo to the report
            var photoFetchSuccess = function (model, response) {
              console.log("We made it and are about tot attach Photos");

              report.attachPhoto(model, function () {
                successCounter++;
                if (successCounter === photoCount) {
                  console.log("All photos attached!");
                  doneSubmit();
                  return;
                }
              });
            };

            // TODO: Implement a error function. What would the behaviour be?
            photo.fetch({success: photoFetchSuccess});


          });
        }
      });
    },

    cancel: function () {
      console.log("Cancelling report...");
      this.clear();
      delete veos.reportForm;
      delete veos.currentReport;
      delete veos.currentInstallation;        // unique to editReport's view
      return true; // will now redirect to clicked element's href
    },

    clear: function () {
      console.log("Clearing ReportForm...");

      // TODO: need to clear photos and stuff

      this.model = new veos.model.Report();
      this.render();

      // FIXME: bad!
      veos.currentReport = this.model;
    },

    updateLocFields: function () {
      //var self = this;
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
        // only set user address from location if user hasn't manually entered it
        if (!self.model.get('loc_description_from_user')) {
          self.model.set('loc_description_from_user', address.formatted_address);
        }
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
      _.each(this.model.changed, function(v, k) {                 // this whole thing needs to be checked over. These refreshes seem wrong. Also, the following 15 lines are 'verbose'... I can only assume Matt will rewrite this in 3 lines
        if (k === "tags") {
          var purposesArray = [];
          var propertiesArray = [];
          var spacesArray = [];
          _.each(v, function(i) {
            if (i.tag_type === "sign_stated_purpose") {
              purposesArray.push(i.tag);
            } else if (i.tag_type === "sign_properties") {
              propertiesArray.push(i.tag);
            } else if (i.tag_type === "surveilled_space") {
              spacesArray.push(i.tag);
            } else {
              console.log("unknown tag type");
            }
          });
          self.$el.find('*[name="sign_stated_purpose"].multi-field').val(purposesArray);
          self.$el.find('*[name="sign_properties"].multi-field').val(propertiesArray);
          self.$el.find('*[name="surveilled_space"].multi-field').val(spacesArray);
        } else if (k === "has_sign") {
          if (self.model.get(k)) {
            jQuery('#sign-yes').attr("checked",true).checkboxradio("refresh"); 
            console.log('true');
          } else if (!self.model.get(k)) {
            jQuery('#sign-no').attr("checked",true).checkboxradio("refresh"); 
            console.log('false');
          }
        }
         else {
          self.$el.find('*[name="'+k+'"].field').val(self.model.get(k));
        }
   
      });


      jQuery('#owner-type').selectmenu('refresh');                          // why doesn't this work with classes? Would be much cleaner
      jQuery('#sign-visibility').selectmenu('refresh');                

      jQuery('#surveilled-space').selectmenu('refresh', 'true');
      jQuery('#sign-stated-purpose').selectmenu('refresh', 'true');
      jQuery('#sign-properties').selectmenu('refresh', 'true');

      // TODO: handle other non-trivial fields like , photo, etc.
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
      //self.renderPhotos();
    }

  });



















  var PhotoView = Backbone.View.extend({
    initialize: function () {
      var view = this;

      this.model.on('image_upload image_upload_finish change sync', this.render, this);

      this.model.on('image_upload_start', function () {
        jQuery.mobile.showPageLoadingMsg();
        jQuery('.ui-loader h1').text('Uploading photo...');
      }, this);

      this.model.on('image_upload_error', function () {
        jQuery.mobile.hidePageLoadingMsg();
      }, this);
    },

    render: function () {
      console.log("Rendering PhotoView...");
      //this.$el.text(JSON.stringify(this.model.toJSON(), null, 2));
      console.log("Photo url: "+this.model.thumbUrl());

      var img = this.$el.find('#photo-'+this.model.id);
      if (img.length === 0) {
        img = jQuery("<img style='display: block' class='photo-list-item' id='photo-"+this.model.id+"' />");
        //img.attr('data-model', this.model);
        img.attr('data-model', JSON.stringify(this.model.toJSON()));
        this.$el.append(img);
      }
      img.attr('src', this.model.thumbUrl());
      img.attr('alt', this.model.get('notes'));

      jQuery.mobile.hidePageLoadingMsg();
    }
  });


  /**
    InstallationList
    Shows a list of Installations.
  **/
  self.InstallationList = Backbone.View.extend({
    MAX_DISTANCE_FROM_CURRENT_LOCATION: 10, // km
    
    events: {
      'click .ui-li': function (ev) {
        console.log("clicked ui-li a");
        veos.currentInstallation = jQuery(ev.target).data('installation');      // next used in the report-edit delegate
      }
    },

    initialize: function () {
      var self = this;

      if (!this.collection) {
        this.collection = new veos.model.Installations();
      }

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Installations too?
      this.collection.on('reset', _.bind(this.render, self));   
    },

    render: function () {
      var list = this.$el.find('.installations-list');
      list.empty();

      this.collection.each(function (installation) {
        var buttonText = '';
        var ownerName;
        if (installation.get('owner_name')) {
          buttonText = "<span class='owner_name'>" + installation.get('owner_name') + "</span><br/>" + installation.getLocDescription();
        } else {
          buttonText = "<span class='owner_name unknown'>Unknown Owner</span><br/>" + installation.getLocDescription();
        }
        
/*                var complianceLevel;                   TODO - add me back in when model supports this
        if (installation.get('compliance_level_override')) {
          complianceLevel = "<span class='compliance-"+installation.get('compliance_level_override')+"'></span>";
        } else if (installation.get('compliance_level')) {
          complianceLevel = "<span class='compliance-"+installation.get('compliance_level')+"'></span>";
        } else {
          complianceLevel = "<span class='compliance-unknown'></span>";
        }*/
        var complianceLevel = "<span class='compliance low'></span>";
        
        var thumb = "";
        var obj = installation.get('photos');
        

        // if photos are attached to the installation retrieve the thumb URL of the first photo via Photo model
        if (installation.has('photos') && installation.get('photos').length > 0) {
          var photoID = installation.get('photos')[0].id;
          thumb = "<img class='list-picture photo-"+photoID+"' />";
          
          console.log('Trying to retrieve photo thumb URL for photo with ID: '+photoID);

          var thumbPhoto = new veos.model.Photo({id: photoID});

          var photoFetchSuccess = function (model, response) {
            console.log("We made it and are about to retrieve Photo thumb URL");
            var img = jQuery('.photo-'+model.id);
            img.attr('src', model.thumbUrl());
          };

          // TODO: think about this since it delets all input on error and returns to map
          var photoFetchError = function (model, response) {
            console.error("Fetching photo model for Installation List failed with error: " +response);
          };

          thumbPhoto.fetch({success: photoFetchSuccess, error: photoFetchError});
        }

        var item = jQuery("<a class='relative' href='installation-details.html?id="+installation.get('id')+"'>"+complianceLevel+thumb+buttonText+"</a>");
        item.data('installation', installation);        // add the installation object so that we can retrieve it in the click event
        var li = jQuery("<li />");
        li.append(item);

        list.append(li);
        list.listview('refresh');
      });
    }
  });


  /**
    InstallationList for Report creation
    Shows a list of Installations.
  **/
  self.InstallationListReport = Backbone.View.extend({
    MAX_DISTANCE_FROM_CURRENT_LOCATION: 10, // km
    
    events: {
      'click .ui-li': function (ev) {
        console.log("clicked ui-li a");
        veos.currentInstallation = jQuery(ev.target).data('installation');      // next used in the report-edit delegate
      }
    },

    initialize: function () {
      var self = this;

      if (!this.collection) {
        this.collection = new veos.model.Installations();
      }

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Installations too?
      this.collection.on('reset', _.bind(this.render, self));   
    },

    render: function () {
      var list = this.$el.find('.installations-list');
      list.empty();

      this.collection.each(function (installation) {
        var buttonText = '';
        var ownerName;
        if (installation.get('owner_name')) {
          buttonText = "<span class='owner_name'>" + installation.get('owner_name') + "</span><br/>" + installation.getLocDescription();
        } else {
          buttonText = "<span class='owner_name unknown'>Unknown Owner</span><br/>" + installation.getLocDescription();
        }
        
/*                var complianceLevel;                   TODO - add me back in when model supports this
        if (installation.get('compliance_level_override')) {
          complianceLevel = "<span class='compliance-"+installation.get('compliance_level_override')+"'></span>";
        } else if (installation.get('compliance_level')) {
          complianceLevel = "<span class='compliance-"+installation.get('compliance_level')+"'></span>";
        } else {
          complianceLevel = "<span class='compliance-unknown'></span>";
        }*/
        var complianceLevel = "<span class='compliance low'></span>";
        
        var thumb;
        var obj = installation.get('photos');
        if (obj && obj[0] && obj[0].image_file_name && obj[0].id) {
          console.log(obj[0].id);
          thumb = "<img class='list-picture' src='"+veos.model.baseURL + "photos/images/" +  obj[0].id + "/thumb/" + obj[0].image_file_name+ ".jpg' />";
        } else {
          thumb = "";
        }

        var item = jQuery("<a class='relative' href=report.html>"+complianceLevel+thumb+buttonText+"</a>");
        item.data('installation', installation);        // add the installation object so that we can retrieve it in the click event
        var li = jQuery("<li />");
        li.append(item);

        list.append(li);
        list.listview('refresh');
      });
    }
  });

  /**
    Extending InstallaionList for report-selection.html TODO - not working
  **/
  // self.InstallationSelectionList = self.InstallationList.extend({
  //   'click a.arrowbutton': function () {
  //     // go to editable version of installation-list.html
  //   }
  // });

  // self.InstallationViewList = self.InstallationList.extend({
  //   'click a.arrowbutton': function () {
  //     // go to installation-list.html
  //   }
  // });

  // self.InstallationSelectionListView = self.InstallationList.extend({
  //   initialize: function () {
  //     this.events['click .ui-btn'] = function(ev) {
  //       alert("clicked some-other thing");
  //     };
  //     this.delegateEvents();
  //   }
  // });

  self.InstallationDetail = Backbone.View.extend({
    initialize: function () {
      var self = this;

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Insts too?
      this.model.on('change sync', _.bind(this.render, self)); 
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

    createPointDetailsMap: function(installation) {
      // note: higher zoom level
      var staticMapCriteria = "http://maps.googleapis.com/maps/api/staticmap?zoom=17&size=150x150&scale=2&sensor=true&center=" + installation.get('loc_lat') + "," + installation.get('loc_lng');
      staticMapCriteria += "&markers=size:small%7C" + installation.get('loc_lat') + ',' + installation.get('loc_lng');
      
      var mapThumbnail = jQuery('<img class="map-thumbnail" />');
      mapThumbnail.attr('src', staticMapCriteria);    
      var thumbnailContainer = this.$el.find('.map-thumbnail-container');
      thumbnailContainer.append(mapThumbnail);
    },

    showPictures: function(installation) {
      console.log('Showing pictures...');
      var photoContainer = this.$el.find('.photo-thumbnail-container');

      _.each(installation.get('photos'), function (p) {
        var photo = new veos.model.Photo({id: p.id});

        function photoSuccess (model, response) {
          var img = jQuery('<img />');
          img.attr('src', model.thumbUrl());
          photoContainer.append(img);
        }

        function photoError (model, response) {
          console.error("Error fetching photo model with message: "+response);
          veos.alert("Error fetching photo details");
        }

        photo.fetch({success: photoSuccess, error: photoError});
      });
    },

    render: function () {
      var self = this;
      var installation = this.model;

      if (this.loader) {
        this.hideLoader();
      }

      this.createPointDetailsMap(installation);

      if (installation.has('photos')) {
        self.showPictures(installation);
      }
      
      var photoThumbnail = jQuery('<img class="photo-thumbnail" />');
      var photoContainer = this.$el.find('.photo-thumbnail-container');

      var ownerName;
      if (installation.has('owner_name')) {
        self.$el.find('.field[name="owner_name"]').val(installation.get('owner_name'));
      } else {
        self.$el.find('.field[name="owner_name"]').val('Unknown Owner');
      }
      
      _.each(installation.attributes, function(v, k) {
        self.$el.find('.field[name="'+k+'"]').val(installation.get(k));

        if (k === "latest_report") {
          _.each(v, function(subv, subk) {
            self.$el.find('.field[name="'+subk+'"]').val(installation.get('latest_report')[subk]);
          });
        }
        // TODO add tags functionality when they exist in the backend
/*        else if (k === "tags") {
          var purposesArray = [];
          var propertiesArray = [];
          var spacesArray = [];
          _.each(v, function(i) {
            if (i.tag_type === "sign_stated_purpose") {
              purposesArray.push(i.tag);
            } else if (i.tag_type === "sign_properties") {
              propertiesArray.push(i.tag);
            } else if (i.tag_type === "surveilled_space") {
              spacesArray.push(i.tag);
            } else {
              console.log("unknown tag type");
            }
          });
          self.$el.find('*[name="sign_stated_purpose"].multi-field').val(purposesArray);
          self.$el.find('*[name="sign_properties"].multi-field').val(propertiesArray);
          self.$el.find('*[name="surveilled_space"].multi-field').val(spacesArray);
        }
        }*/
      });

    }
  });


  /***********************************************************************************************************************************/


  /**
    ReportList
    Shows a list of Reports.                LEGACY CODE
  **/
  self.ReportList = Backbone.View.extend({
    MAX_DISTANCE_FROM_CURRENT_LOCATION: 10, // km
    events: {
      'click .ui-btn': function (ev) {
        console.log("clicked ui-button");
      }
    },

    initialize: function () {
      var self = this;

      if (!this.collection) {
        this.collection = new veos.model.Reports();
      }

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Reports too?
      this.collection.on('reset', _.bind(this.render, self)); 
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
        var ownerName;
        if (report.get('owner_name')) {
          ownerName = "<span class='owner_name'>" + report.get('owner_name') + "</span><br/>" + report.getLocDescription();
        } else {
          ownerName = "<span class='owner_name unknown'>Unknown Owner</span><br/>" + report.getLocDescription();
        }

        // var thumb;
        // var obj = report.get('photos');
        // if (obj && obj.photos && obj.photos[0] && obj.photos[0].thumb_url) {
        //     thumb = "<img src='"+veos.model.baseURL + obj.photos[0].thumb_url+"' />";
        // } else {
        //     thumb = "";
        // }

        var item = jQuery("<li><a href='report-details.html?id="+report.id+"'>"+ownerName+"</a></li>");
        list.append(item);
        list.listview('refresh');
      });
    }
  });

  // WHY YOU NO WORK?!
/*    self.ReportSelectionListView = self.ReportList.extend({
    initialize: function () {
      this.events['click .ui-btn'] = function(ev) {
        alert("clicked some-other thing");
      }
      this.delegateEvents();
    }
  });*/

  /**
    report-details
    Shows detailed information about a report.          LEGACY CODE
  **/
  self.ReportDetail = Backbone.View.extend({
    initialize: function () {
      var self = this;

      // TODO: consider binding 'add' and 'remove' to pick up added/removed Reports too?
      this.model.on('change sync', _.bind(this.render, self)); 
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

    createPointDetailsMap: function(report) {
      var latLng = report.getLatLng();
      
      // note: higher zoom level
      var staticMapCriteria = "http://maps.googleapis.com/maps/api/staticmap?zoom=17&size=150x150&scale=2&sensor=true&center=" + latLng.lat() + "," + latLng.lng();
      staticMapCriteria += "&markers=size:small%7C" + latLng.lat() + ',' + latLng.lng();
      
      var mapThumbnail = jQuery('<img class="map-thumbnail" />');
      mapThumbnail.attr('src', staticMapCriteria);    
      var thumbnailContainer = this.$el.find('.map-thumbnail-container');
      thumbnailContainer.append(mapThumbnail);    
    },

    render: function () {
      var report = this.model;

      if (this.loader) {
        this.hideLoader();
      }

      this.createPointDetailsMap(report);
      
      var photoThumbnail = jQuery('<img class="photo-thumbnail" />');
      var photoContainer = this.$el.find('.photo-thumbnail-container');

      var ownerName;
      if (report.get('owner_name')) {
        ownerName = "<span class='owner_name'>" + report.get('owner_name') + "</span>";
      } else {
        ownerName = "<span class='owner_name unknown'>Unknown Owner</span>";
      }

      this.$el.find('.installation-title').html(ownerName);
    }
  });


  veos.view = self;
})(window.veos);