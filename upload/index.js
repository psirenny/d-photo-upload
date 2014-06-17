var _ = require('lodash')
  , imageUtil = require('./util/image');

exports.create = function (model, dom) {
  var $el = document.createElement('div')
    , $clear = dom.element('clear')
    , $dropzone = dom.element('dropzone')
    , $input = dom.element('input')
    , $scale = dom.element('scale');

  function selectImage(file) {
    model.set('image.data', file);
    load(model, dom);
  }

  model.on('change', 'height', function () {
    load(model, dom);
  });

  model.on('change', 'image.scale', function (scale, prev, passed) {
    $($scale).panzoom('zoom', parseFloat(scale));
  });

  model.on('change', 'image.transform', function (matrix, prev, passed) {
    edit(model, dom);
  });

  model.on('change', 'size', function () {
    load(model, dom);
  });

  model.on('change', 'width', function () {
    load(model, dom);
  });

  dom.addListener($clear || $el, 'click', function () {
    var $newInput = $($input).val('').clone(true)[0];
    $($input).replaceWith($newInput);
    $input = $newInput;
    model.del('image');
    model.set('image.object.src', '');

    dom.addListener($input, 'change', function (e) {
      selectImage(e.target.files[0]);
    });
  });

  dom.addListener($input, 'change', function (e) {
    selectImage(e.target.files[0]);
  });

  dom.addListener($dropzone, 'dragenter', function (e) {
    e.stopPropagation();
    e.preventDefault();
  });

  dom.addListener($dropzone, 'dragover', function (e) {
    e.stopPropagation();
    e.preventDefault();
  });

  dom.addListener($dropzone, 'drop', function (e) {
    e.stopPropagation();
    e.preventDefault();
    var file = e.dataTransfer.files[0];
    var url = e.dataTransfer.getData('text');
    selectImage(file || url);
  });
};

exports.reset = function () {
  var $image = this.dom.element('image');
  $($image).panzoom('reset');
};

function edit(model, dom) {
  var $container = $(dom.element('container'))
    , targetSize = model.get('size')
    , targetHeight = model.get('height') || targetSize
    , targetWidth = model.get('width') || targetSize
    , contained = model.get('contained')
    , containerHeight = contained ? $container.height() : targetHeight
    , containerWidth = contained ? $container.width() : targetWidth
    , image = model.get('image.object')
    , matrix = model.get('image.transform');

  imageUtil.transform(image, matrix, containerWidth, containerHeight, targetWidth, targetHeight,
    function (err, image) {
      imageUtil.toBlob(image, function (err, blob) {
        model.set('image.edited.blob', blob);
        model.set('image.edited.object', image);
      })
    }
  );
}

function load(model, dom) {
  var $container = $(dom.element('container'));
  var data = model.get('image.data');
  if (!data) return;

  model.set('loading', true);
  imageUtil.create(data, function (err, image) {
    var $image = dom.element('image')
      , $reset = dom.element('reset')
      , $scale = dom.element('scale')
      , targetSize = model.get('size')
      , targetHeight = model.get('height') || targetSize
      , targetWidth = model.get('width') || targetSize
      , contained = model.get('contained')
      , containerHeight = contained ? $container.height() : targetHeight
      , containerWidth = contained ? $container.width() : targetWidth
      , imageHeight = Math.max(containerHeight, image.height)
      , imageWidth = Math.max(containerWidth, image.width)
      , minScaleX = containerWidth / imageWidth
      , minScaleY = containerHeight / imageHeight
      , minScale = Math.max(minScaleX, minScaleY)
      , maxScaleX = containerWidth / targetWidth
      , maxScaleY = containerHeight / targetHeight
      , maxScale = Math.max(maxScaleX, maxScaleY)
      , offsetX = -maxScale * imageWidth
      , offsetY = -maxScale * imageHeight
      , matrix = [maxScale, 0, 0, maxScale, offsetX, offsetY];

    imageUtil.resize(image, imageWidth, imageHeight, function (err, image) {
      model.set('image.canScale', maxScale > minScale);
      model.set('image.maxScale', maxScale);
      model.set('image.minScale', minScale);
      model.set('image.object', image);

      var transform = _.debounce(function (e, panzoom, matrix) {
        model.silent().set('image.scale', matrix[0]);
        model.set('image.transform', matrix);
      }, 100);

      $($image).panzoom({
        $reset: $($reset),
        $zoomRange: $($scale),
        contain: 'invert',
        onChange: transform,
        maxScale: maxScale,
        minScale: minScale,
        startTransform: 'matrix(' + matrix.join(',') + ')'
      });

      model.set('image.transform', matrix);
      model.del('loading');
      edit(model, dom);
    });
  });
}
