/*jshint browser: true, devel: true, debug: true, forin: true, noempty: true, eqeqeq: true, boss: true,
loopfunc: true, bitwise: true, curly: true, indent: 2, maxerr:50, white:false */

window.installations = (function(installations) {
  var self = installations;



  var reports = new veos.model.Reports();  // creates the "reports" collection proxy object

  // retrieves all of the reports from the server
  reports.fetch({
    success: function () {
      console.log(reports.get(20).attributes.media[1].thumb_url);
      console.log('id_20 lat: ' + reports.get(20).attributes.latitude);
      console.log('id_20 long: ' + reports.get(20).attributes.longitude);

      // creating the jQuery button to be filled with returned content. Why are you so ugly jQuery?
      var divA = jQuery('<div class="ui-block-a">')
      var installationOuterButton = jQuery('<a data-role="button" data-transition="fade" href="#installation-details-page"	data-icon="arrow-r" data-iconpos="left" data-theme="c" class="ui-btn ui-btn-icon-left ui-btn-corner-all ui-shadow ui-btn-up-c"></a>');
      var installationInnerButton = jQuery('<span class="ui-btn-inner ui-btn-corner-all">');
      var installationButtonIcon = jQuery('<span class="ui-icon ui-icon-arrow-r ui-icon-shadow">');
      installationOuterButton.append(installationInnerButton);
      installationOuterButton.append(installationButtonIcon);
      divA.append(installationOuterButton);
      installationInnerButton.text(reports.get(20).attributes.location_name);

      var divB = jQuery('<div class="ui-block-b">')
      var installationThumbnail = jQuery('<img class="photo-thumbnail" />');
      installationThumbnail.attr('src', reports.get(20).attributes.media[1].link_url);   // thumb_url may look better, check on phone
      divB.append(installationThumbnail);

      var installationGrid = jQuery('#installations-page .ui-grid-a');
      installationGrid.append(divA);
      installationGrid.append(divB);


      //jQuery('.inst1').text(reports.get(20).attributes.location_name);
      //jQuery('.inst2').text(reports.get(21).attributes.location_name);
/*            reports.each(function(report) {
          console.log('starting list');
          console.log(report.get('incident_title'));
      });*/

/*      reports.each(function(id) {
          var installationButton = jQuery('<div class="ui-block-a"><a data-role="button" data-transition="fade"
          	data-icon="arrow-r" data-iconpos="left"></a></div>');
          installationButton.text(reports.get(id).attributes.location_name);

          var installationThumbnail = jQuery('<div class="ui-block-b"><img class="photo-thumbnail" /></div>');
          // TODO - will it always be media[1]?
          installationThumbnail.attr('src', reports.get(id).attributes.media[1].thumb_url);

      });*/

    },
    error: function () {
      // is there an actual error code I should be using here?
      alert('Unable to access database. Please confirm you are connected to the internet and try again. Alternatively, the VEOS server may be down')
    }
  });


	

	// I know why this isn't working, but how can we fix it? Basically, we want:
	// if ((distanceToInstallation(reports.get(20).attributes.latitude,reports.get(20).attributes.longitude)) < 2)
	// to work. Do we really have to wrap geolocationSuccess around everything?
  console.log('distance between your location and installation with id_20: ' + distanceToInstallation(43.656176, -79.380931) + ' km');

  // does this need to be wrapped in a deviceready?
  function distanceToInstallation(lat, lon) {
  	var d = 10;
		navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationFailure);
		
		function geolocationSuccess (currentLocation) {
			console.log('current location is:' + currentLocation.coords.latitude + ',' + currentLocation.coords.longitude);

			if (typeof(Number.prototype.toRad) === "undefined") {
	  		Number.prototype.toRad = function() {
			    return this * Math.PI / 180;
			  }
			}

			var lat1 = currentLocation.coords.latitude;
			var lon1 = currentLocation.coords.longitude;
			var lat2 = lat;
			var lon2 = lon;
			var R = 6371; // km
			var dLat = (lat2-lat1).toRad();
			var dLon = (lon2-lon1).toRad();
			lat1 = lat1.toRad();
			lat2 = lat2.toRad();

			var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
			        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
			var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
			d = R * c;
			console.log('d:' + d);
			//return d;
		}

		function geolocationFailure (errorMessage) {
			alert('There was a problem determining your location due to: ' + error.message);
		}
  }

  return self;
})(window.installations || {});