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

    return self;
})(window.veos || {});
