
BUNDLES = {
  'deps.preinit' => [
    'cordova-1.5.0',
    'jquery-1.6.4.min'
  ],
  'deps.postinit' => [
    'jquery.mobile-1.0.1.min',
    'jquery.mobile.autoComplete-1.4.3',
    'underscore-1.3.1.min',
    'backbone-0.9.2.min'
  ]
}


if ARGV.length == 0
  selected_bundles = ['deps.preinit']
else
  selected_bundles = ARGV.map{|arg| arg.to_s}.uniq
end

selected_bundles.each do |bundle|
  File.open("#{bundle}.BUNDLE.js", 'w') do |bundle_file|
    js = ""
    js << "\n\n/*** ----------- start of [#{bundle}] ----------- ***/\n\n"

    BUNDLES[bundle].each do |jsfile|
      jsfile = jsfile + ".js"
      js <<  "\n\n/*** [#{jsfile}] ***/\n\n"
      js << File.open(jsfile, "r").read
    end

    js << "\n\n/*** ----------- end of [#{bundle}] ----------- ***/\n\n"

    bundle_file.write(js)
  end
end
