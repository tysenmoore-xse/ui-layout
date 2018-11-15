'use strict';

/**
 * UI.Layout
 */
angular.module('ui.layout', [])
  .controller('uiLayoutCtrl', ['$scope', '$attrs', '$element', '$timeout', '$window', 'LayoutContainer', 'Layout',
  function uiLayoutCtrl($scope, $attrs, $element, $timeout, $window, LayoutContainer, Layout) {

    var ctrl = this;
    var opts = angular.extend({}, $scope.$eval($attrs.uiLayout), $scope.$eval($attrs.options));
    var numOfSplitbars = 0;
    //var cache = {};
    var animationFrameRequested;
    var lastPos;

    // regex to verify size is properly set to pixels or percent
    var sizePattern = /\d+\s*(px|%)\s*$/i;

    var rowProperties = { sizeProperty: 'height',
                          offsetSize: 'offsetHeight',
                          offsetPos: 'top',
                          flowProperty: 'top',
                          oppositeFlowProperty: 'bottom',
                          mouseProperty: 'clientY',
                          flowPropertyPosition: 'y' };

    var colProperties =  { sizeProperty: 'width',
                           offsetSize: 'offsetWidth',
                           offsetPos: 'left',
                           flowProperty: 'left',
                           oppositeFlowProperty: 'right',
                           mouseProperty: 'clientX',
                           flowPropertyPosition: 'x' };

    var unsubscribeLayout = Layout.addLayout(ctrl);

    if (angular.isUndefined(opts.flow)) {
      opts.flow = $scope.flow;
    }

    ctrl.containers = [];
    ctrl.movingSplitbar = null;
    ctrl.bounds = $element[0].getBoundingClientRect();
    ctrl.isUsingColumnFlow = opts.flow === 'column';

    ctrl.sizeProperties = !ctrl.isUsingColumnFlow ? rowProperties : colProperties;
    ctrl.layoutElem     = $element;

    ctrl.destroy = function() {
      unsubscribeLayout();
    };

    $element
      // Force the layout to fill the parent space
      // fix no height layout...
      .addClass('stretch')
      // set the layout css class
      .addClass('ui-layout-' + (opts.flow || 'row'));

    if (opts.disableToggle) {
      $element.addClass('no-toggle');
    }
    if (opts.disableMobileToggle) {
      $element.addClass('no-mobile-toggle');
    }

    // Initial global size definition
    opts.sizes = opts.sizes || [];
    opts.maxSizes = opts.maxSizes || [];
    opts.minSizes = opts.minSizes || [];
    opts.dividerSize = opts.dividerSize === undefined ? 10 : opts.dividerSize;
    opts.collapsed = opts.collapsed || [];
    ctrl.opts = opts;

    if((!ctrl.bounds.height) && (!ctrl.bounds.width)) {
      // If [for example] the layout is in a tab and we change away and
      // come back we will have zero bounds, so update later.
      $timeout(function() {
          ctrl.bounds = $element[0].getBoundingClientRect();
          ctrl.calculate();
      }, 50);
    }

    $scope.updateDisplay = function() {
      ctrl.calculate();
    };

    angular.element($window).on('resize', function() {
      ctrl.bounds = $element[0].getBoundingClientRect();
      if (!ctrl.bounds.width) {
        // layout must have been not visible then resized
        // to a larger size.
        $timeout(function() {
          ctrl.bounds = $element[0].getBoundingClientRect();
          ctrl.calculate();
        }, 50);
      }
    });

    $scope.$on( '$destroy', $scope.$watch('flow', function(val, old) {

        var x,y;
        var obj;

        if (val === old) {
            return;
        }

        var oldSizeProperties = (old === 'row') ? rowProperties : colProperties;

        // Reset the opts based on the settings
        var origOpts = angular.extend({}, $scope.$eval($attrs.uiLayout), $scope.$eval($attrs.options));
        origOpts.sizes = origOpts.sizes || [];
        origOpts.maxSizes = origOpts.maxSizes || [];
        origOpts.minSizes = origOpts.minSizes || [];
        origOpts.dividerSize = origOpts.dividerSize === undefined ? 10 : origOpts.dividerSize;
        origOpts.collapsed = origOpts.collapsed || [];
        ctrl.opts = origOpts;

        ctrl.opts.flow = val;
        ctrl.bounds    = $element[0].getBoundingClientRect();

        ctrl.isUsingColumnFlow = (val === 'column');
        ctrl.sizeProperties = !ctrl.isUsingColumnFlow ? rowProperties : colProperties;

        $element.removeClass('ui-layout-' + old);
        $element.addClass('ui-layout-' + val);

        // Remove the previous sizes
        $element.css('top',    '');
        $element.css('left',   '');
        $element.css('width',  '');
        $element.css('height', '');

        var szMax = ctrl.bounds[oldSizeProperties.sizeProperty];
        var percentCont;
        var usedSpace = 0;

        // Remove  the divider sizes from the overall size
        for (x = 0; x < ctrl.containers.length; x++) {
          if (LayoutContainer.isSplitbar(ctrl.containers[x])) {
            szMax -= ctrl.containers[x].size;
          }
        }

        for(x = 0; x < ctrl.containers.length; x++) {

          if (ctrl.containers[x].element.hasClass('ui-layout-' + old)) {
            ctrl.containers[x].element.removeClass('ui-layout-' + old);
            ctrl.containers[x].element.addClass('ui-layout-' + val);
          }

          if (ctrl.containers[x].element.hasClass('animate-' + old)) {
            ctrl.containers[x].element.removeClass('animate-' + old);
            ctrl.containers[x].element.addClass('animate-' + val);
          }

          // Remove the previous sizes
          ctrl.containers[x].element.css('top',    '');
          ctrl.containers[x].element.css('left',   '');
          ctrl.containers[x].element.css('width',  '');
          ctrl.containers[x].element.css('height', '');

          if (LayoutContainer.isSplitbar(ctrl.containers[x])) {

            // Maintain divider size
            ctrl.containers[x].element.css( ctrl.sizeProperties.sizeProperty,
                                            ctrl.opts.dividerSize+'px' );
            // switch the icons
            for(y = 0; y < ctrl.containers[x].element[0].children.length; y++) {

              //icon <a> elements
              obj = angular.element(ctrl.containers[x].element[0].children[y]);
              if (obj[0].localName === "a") {
                //icon <span> elements
                obj = angular.element(obj[0].children[0]);
                if (obj[0].localName === "span") {
                  if (obj.hasClass('ui-splitbar-icon-left')) {
                    obj.removeClass('ui-splitbar-icon-left');
                    obj.addClass('ui-splitbar-icon-up');
                  }
                  else if (obj.hasClass('ui-splitbar-icon-right')) {
                    obj.removeClass('ui-splitbar-icon-right');
                    obj.addClass('ui-splitbar-icon-down');
                  }
                  else if (obj.hasClass('ui-splitbar-icon-up')) {
                    obj.removeClass('ui-splitbar-icon-up');
                    obj.addClass('ui-splitbar-icon-left');
                  }
                  else if (obj.hasClass('ui-splitbar-icon-down')) {
                    obj.removeClass('ui-splitbar-icon-down');
                    obj.addClass('ui-splitbar-icon-right');
                  }
                }
              }
            }

            usedSpace += ctrl.containers[x].size;
          }
          else {
            // Resize the container based on the original percentage used
            // so we do not exceed the new sizeProperty bounds.
            // (round down to the tenths place)
            percentCont = Math.floor((ctrl.containers[x].size / szMax)*10);
            if (percentCont === 0) {
              percentCont = 1;
            }
            percentCont = percentCont / 10;

            opts.sizes[x] = Math.floor(ctrl.bounds[ctrl.sizeProperties.sizeProperty] * percentCont);
            usedSpace += opts.sizes[x];

            if (x+1 === ctrl.containers.length) {
              // Last node, add remainder of space
              opts.sizes[x] += (ctrl.bounds[ctrl.sizeProperties.sizeProperty] - usedSpace);

              if ((angular.isNumber(opts.minSizes[x])) &&
                  (opts.sizes[x] < opts.minSizes[x])) {
                // Remove some space from the previous container
                var cont = ctrl.getPreviousContainer(ctrl.containers[x]);
                if (cont !== null) {
                  var szDiff = opts.minSizes[x] - opts.sizes[x];
                  opts.sizes[x] = opts.minSizes[x]; // will happen later anyways
                  if ((cont.size - szDiff) > 0) {
                    cont.size -= szDiff;
                    cont.uncollapsedSize -= szDiff;
                  }
                }
              }
            }

            ctrl.containers[x].size = opts.sizes[x];
            ctrl.containers[x].uncollapsedSize = opts.sizes[x];
          }
        }

        $scope.$evalAsync(function() {
          ctrl.calculate();

          for (x = 0; x < ctrl.containers.length; x++) {

            obj = ctrl.containers[x];

            // width | height
            obj.element.css(ctrl.sizeProperties.sizeProperty,  obj.size + 'px');

            if (ctrl.isUsingColumnFlow) {

              if (angular.isDefined(obj.left)) {
                obj.element.css('left',   obj.left + 'px');
              }

            } else {
              if (angular.isDefined(obj.top)) {
                obj.element.css('top',    obj.top + 'px');
              }
            }
          }

        });
    }) );

    var debounceEvent;
    function draw() {
      var position = ctrl.sizeProperties.flowProperty;
      var dividerSize = parseInt(opts.dividerSize);
      var elementSize = $element[0][ctrl.sizeProperties.offsetSize];

      if(ctrl.movingSplitbar !== null) {
        var splitbarIndex = ctrl.containers.indexOf(ctrl.movingSplitbar);
        var nextSplitbarIndex = (splitbarIndex + 2) < ctrl.containers.length ? splitbarIndex + 2 : null;

        if(splitbarIndex > -1) {
          var processedContainers = ctrl.processSplitbar(ctrl.containers[splitbarIndex]);
          var beforeContainer = processedContainers.beforeContainer;
          var afterContainer = processedContainers.afterContainer;

          if(!beforeContainer.collapsed && !afterContainer.collapsed) {
            // calculate container positons
            var difference = ctrl.movingSplitbar[position] - lastPos;
            var newPosition = ctrl.movingSplitbar[position] - difference;

            // Keep the bar in the window (no left/top 100%)
            newPosition = Math.min(elementSize-dividerSize, newPosition);

            // Keep the bar from going past the previous element min/max values
            if(angular.isNumber(beforeContainer.beforeMinValue) && newPosition < beforeContainer.beforeMinValue)
              newPosition = beforeContainer.beforeMinValue;
            if(angular.isNumber(beforeContainer.beforeMaxValue) && newPosition > beforeContainer.beforeMaxValue)
              newPosition = beforeContainer.beforeMaxValue;

            // Keep the bar from going past the next element min/max values
            if(afterContainer !== null &&
              angular.isNumber(afterContainer.afterMinValue) &&
              newPosition > (afterContainer.afterMinValue - dividerSize))
              newPosition = afterContainer.afterMinValue - dividerSize;
            if(afterContainer !== null && angular.isNumber(afterContainer.afterMaxValue) && newPosition < afterContainer.afterMaxValue)
              newPosition = afterContainer.afterMaxValue;

            // resize the before container
            beforeContainer.size = newPosition - beforeContainer[position];
            // store the current value to preserve this size during onResize
            beforeContainer.uncollapsedSize = beforeContainer.size;

            // update after container position
            var oldAfterContainerPosition = afterContainer[position];
            afterContainer[position] = newPosition + dividerSize;

            //update after container size if the position has changed
            if(afterContainer[position] != oldAfterContainerPosition) {
              afterContainer.size = (nextSplitbarIndex !== null) ?
              (oldAfterContainerPosition + afterContainer.size) - (newPosition + dividerSize) :
              elementSize - (newPosition + dividerSize);
              // store the current value to preserve this size during onResize
              afterContainer.uncollapsedSize = afterContainer.size;
            }

            // move the splitbar
            ctrl.movingSplitbar[position] = newPosition;

            // broadcast an event that resize happened (debounced to 50ms)
            if(debounceEvent) $timeout.cancel(debounceEvent);
            debounceEvent = $timeout(function() {
              $scope.$broadcast('ui.layout.resize', beforeContainer, afterContainer);
              debounceEvent = null;
            }, 50, false);
          }
        }
      }

      //Enable a new animation frame
      animationFrameRequested = null;
    }

    function offset(element) {
      var rawDomNode = element[0];
      var body = document.documentElement || document.body;
      var scrollX = window.pageXOffset || body.scrollLeft;
      var scrollY = window.pageYOffset || body.scrollTop;
      var clientRect = rawDomNode.getBoundingClientRect();
      var x = clientRect.left + scrollX;
      var y = clientRect.top + scrollY;
      return { left: x, top: y };
    }

    /**
     * Returns the current value for an option
     * @param  option   The option to get the value for
     * @return The value of the option. Returns null if there was no option set.
     */
    function optionValue(option) {
      if(typeof option == 'number' || typeof option == 'string' && option.match(sizePattern)) {
        return option;
      } else {
        return null;
      }
    }

    //================================================================================
    // Public Controller Functions
    //================================================================================
    ctrl.mouseUpHandler = function(event) {
      if(ctrl.movingSplitbar !== null) {
        ctrl.movingSplitbar = null;
      }
      return event;
    };

    ctrl.mouseMoveHandler = function(mouseEvent) {
      var mousePos = mouseEvent[ctrl.sizeProperties.mouseProperty] ||
        (mouseEvent.originalEvent && mouseEvent.originalEvent[ctrl.sizeProperties.mouseProperty]) ||
        // jQuery does touches weird, see #82
        ($window.jQuery ?
          (mouseEvent.originalEvent ? mouseEvent.originalEvent.targetTouches[0][ctrl.sizeProperties.mouseProperty] : 0) :
          (mouseEvent.targetTouches ? mouseEvent.targetTouches[0][ctrl.sizeProperties.mouseProperty] : 0));

      lastPos = mousePos - offset($element)[ctrl.sizeProperties.offsetPos];

      //Cancel previous rAF call
      if(animationFrameRequested) {
        window.cancelAnimationFrame(animationFrameRequested);
      }

      //TODO: cache layout values

      //Animate the page outside the event
      animationFrameRequested = window.requestAnimationFrame(draw);
    };

    /**
     * Returns the min and max values of the ctrl.containers on each side of the container submitted
     * @param container
     * @returns {*}
     */
    ctrl.processSplitbar = function(container) {
      var index = ctrl.containers.indexOf(container);

      var setValues = function(container) {


        if (angular.isUndefined(container)) {
            return;
        }

        var maxSize = container.maxSize;
        var minSize = container.minSize;

        var start = container[ctrl.sizeProperties.flowProperty];
        var end = container[ctrl.sizeProperties.flowProperty] + container.size;

        if (!container.isShown) {
          minSize = 0;
        }

        container.beforeMinValue = angular.isNumber(minSize) ? start + minSize : start;
        container.beforeMaxValue = angular.isNumber(maxSize) ? start + maxSize : null;

        container.afterMinValue = angular.isNumber(minSize) ? end - minSize : end;
        container.afterMaxValue = angular.isNumber(maxSize) ? end - maxSize : null;
      };

      //verify the container was found in the list
      if(index > -1) {
        var beforeContainer = (index > 0) ? ctrl.containers[index-1] : null;
        var afterContainer = ((index+1) <= ctrl.containers.length) ? ctrl.containers[index+1] : null;

        if(beforeContainer !== null) setValues(beforeContainer);
        if(afterContainer !== null) setValues(afterContainer);

        return {
          beforeContainer: beforeContainer,
          afterContainer: afterContainer
        };
      }

      return null;
    };

    /**
     * Checks if a string has a percent symbol in it.
     * @param num
     * @returns {boolean}
     */
    ctrl.isPercent = function(num) {
      return (num && angular.isString(num) && num.indexOf('%') > -1) ? true : false;
    };

    /**
     * Converts a number to pixels from percent.
     * @param size
     * @param parentSize
     * @returns {number}
     */
    ctrl.convertToPixels = function(size, parentSize) {
      return Math.floor(parentSize * (parseInt(size) / 100));
    };

    /**
     * Sets the default size for each container.
     */
    ctrl.calculate = function() {
      var c, i;
      var dividerSize = parseInt(opts.dividerSize);
      var elementSize = $element[0].getBoundingClientRect()[ctrl.sizeProperties.sizeProperty];
      var availableSize = elementSize - (dividerSize * numOfSplitbars);
      var originalSize = availableSize;
      var usedSpace = 0;
      var numOfAutoContainers = 0;

      // When we change from one tab and back the bounds will be
      // zero for a short time.  If we run this routine when the
      // bounds are zero the min/maxSizes will be zero and will
      // not work properly.
      if(!ctrl.bounds.width) {
        return;
      }

      if(ctrl.containers.length > 0 && $element.children().length > 0) {

        // calculate sizing for ctrl.containers
        for(i=0; i < ctrl.containers.length; i++) {
          if(!LayoutContainer.isSplitbar(ctrl.containers[i])) {

            c = ctrl.containers[i];
            opts.sizes[i] = c.isCentral ? 'auto' : c.collapsed ? (optionValue(c.minSize) || '0px') : optionValue(c.uncollapsedSize) || 'auto';
            opts.minSizes[i] = optionValue(c.minSize);
            opts.maxSizes[i] = optionValue(c.maxSize);

            if(opts.sizes[i] !== 'auto') {
              if(ctrl.isPercent(opts.sizes[i])) {
                opts.sizes[i] = ctrl.convertToPixels(opts.sizes[i], originalSize);
              } else {
                opts.sizes[i] = parseInt(opts.sizes[i]);
              }
            }

            if(opts.minSizes[i] !== null) {
              if(ctrl.isPercent(opts.minSizes[i])) {
                opts.minSizes[i] = ctrl.convertToPixels(opts.minSizes[i], originalSize);
              } else {
                opts.minSizes[i] = parseInt(opts.minSizes[i]);
              }

              // don't allow the container size to initialize smaller than the minSize
              if (!c.collapsed && opts.sizes[i] < opts.minSizes[i]) {
                if (c.isShown) {
                  opts.sizes[i] = opts.minSizes[i];
                }
                else {
                  opts.sizes[i] = 0;
                }
              }
            }

            if(opts.maxSizes[i] !== null) {
              if(ctrl.isPercent(opts.maxSizes[i])) {
                opts.maxSizes[i] = ctrl.convertToPixels(opts.maxSizes[i], originalSize);
              } else {
                opts.maxSizes[i] = parseInt(opts.maxSizes[i]);
              }

              // don't allow the container size to intialize larger than the maxSize
              if (opts.sizes[i] > opts.maxSizes[i]) {
                  opts.sizes[i] = opts.maxSizes[i];
              }
            }

            if(opts.sizes[i] === 'auto') {
              numOfAutoContainers++;
            } else {
              availableSize -= opts.sizes[i];
            }
          }
        }

        // FIXME: autoSize if frequently Infinity, since numOfAutoContainers is frequently 0, no need to calculate that
        // set the sizing for the ctrl.containers
        /*
         * When the parent size is odd, rounding down the `autoSize` leaves a remainder.
         * This remainder is added to the last auto-sized container in a layout.
         */
        var autoSize = Math.floor(availableSize / numOfAutoContainers),
          remainder = availableSize - autoSize * numOfAutoContainers;
        for(i=0; i < ctrl.containers.length; i++) {
          c = ctrl.containers[i];
          c[ctrl.sizeProperties.flowProperty] = usedSpace;
          c.maxSize = opts.maxSizes[i];
          c.minSize = opts.minSizes[i];

          //TODO: adjust size if autosize is greater than the maxSize

          if(!LayoutContainer.isSplitbar(c)) {
            var newSize;
            if(opts.sizes[i] === 'auto') {
              newSize = autoSize;
              // add the rounding down remainder to the last auto-sized container in the layout
              if (remainder > 0 && i === ctrl.containers.length - 1) {
                newSize += remainder;
              }
            } else {
              if (c.isShown) {
                newSize = opts.sizes[i];
              }
              else {
                newSize = 0;

                var cont = ctrl.getPreviousContainer( c );
                if (cont !== null) {
                  // Add to the PREVIOUS container the space we would have used
                  opts.sizes[cont.index] += opts.sizes[i];

                  cont.size += opts.sizes[i];
                  usedSpace += opts.sizes[i];
                  opts.sizes[i] = 0;
                }
                else {
                  cont = ctrl.getNextContainer( c );
                  if (cont !== null) {
                    // Add to the NEXT container the space we would have used
                    if (opts.sizes[cont.index] !== 'auto') {
                      opts.sizes[cont.index] += opts.sizes[i];

                      cont.size += opts.sizes[i];
                      usedSpace += opts.sizes[i];
                      opts.sizes[i] = 0;
                    }
                    else {
                      //opts.sizes[cont.index] += autoSize;
                    }
                  }
                }
              }
            }

            c.size = (newSize !== null) ? newSize : autoSize;
          } else {
            c.size = dividerSize;
          }

          usedSpace += c.size;
        }
      }
    };

    /**
     * Adds a container to the list of layout ctrl.containers.
     * @param container The container to add
     */
    ctrl.addContainer = function(container) {
      var index = ctrl.indexOfElement(container.element);
      if(!angular.isDefined(index) || index < 0 || ctrl.containers.length < index) {
        console.error("Invalid index to add container; i=" + index + ", len=", ctrl.containers.length);
        return;
      }

      if(LayoutContainer.isSplitbar(container)) {
        numOfSplitbars++;
      }

      container.index = index;
      ctrl.containers.splice(index, 0, container);

      ctrl.calculate();
    };

    /**
     * Remove a container from the list of layout ctrl.containers.
     * @param  container
     */
    ctrl.removeContainer = function(container) {
      var index = ctrl.containers.indexOf(container);
      if(index >= 0) {
        if(!LayoutContainer.isSplitbar(container)) {
          if(ctrl.containers.length > 2) {
            // Assume there's a sidebar between each container
            // We need to remove this container and the sidebar next to it
            if(index == ctrl.containers.length - 1) {
              // We're removing the last element, the side bar is on the left
              ctrl.containers[index-1].element.remove();
            } else {
              // The side bar is on the right
              ctrl.containers[index+1].element.remove();
            }
          }
        } else {
          // fix for potentially collapsed containers
          ctrl.containers[index - 1].collapsed = false;
          numOfSplitbars--;
        }

        // Need to re-check the index, as a side bar may have been removed
        var newIndex = ctrl.containers.indexOf(container);
        if(newIndex >= 0) {
          ctrl.containers.splice(newIndex, 1);
          ctrl.opts.maxSizes.splice(newIndex, 1);
          ctrl.opts.minSizes.splice(newIndex, 1);
          ctrl.opts.sizes.splice(newIndex, 1);
        }
        ctrl.calculate();
      } else {
        console.error("removeContainer for container that did not exist!");
      }
    };

    /**
     * Returns an array of layout ctrl.containers.
     * @returns {Array}
     */
    ctrl.getContainers = function() {
      return ctrl.containers;
    };

    ctrl.toggleContainer = function(index) {

      var splitter = ctrl.containers[index + 1],
        el;

      if (splitter) {
        el = splitter.element[0].children[0];
      } else {
        splitter = ctrl.containers[index - 1];
        el = splitter.element[0].children[1];
      }

      $timeout(function(){
        angular.element(el).triggerHandler('click');
      });
    };

    /**
     * Toggles the container before the provided splitbar
     * @param splitbar
     * @returns {boolean|*|Array}
     */
    ctrl.toggleBefore = function(splitbar) {
      var index = ctrl.containers.indexOf(splitbar) - 1;

      var c = ctrl.containers[index];
      c.collapsed = !ctrl.containers[index].collapsed;

      var nextSplitbar = ctrl.containers[index+1];
      var nextContainer = ctrl.containers[index+2];

      // uncollapsedSize is undefined in case of 'auto' sized containers.
      // Perhaps there's a place where we could set... could find it though. @see also toggleBefore
      if (c.uncollapsedSize === undefined) {
        c.uncollapsedSize = c.size;
      } else {
        c.uncollapsedSize = parseInt(c.uncollapsedSize);
      }
      // FIXME: collapse:resize:uncollapse: works well "visually" without the nextSplitbar and nextContainer calculations
      // but removing those breaks few test
      $scope.$apply(function() {
        if(c.collapsed) {

          c.size = 0;

          if(nextSplitbar) nextSplitbar[ctrl.sizeProperties.flowProperty] -= c.uncollapsedSize;
          if(nextContainer) {
            nextContainer[ctrl.sizeProperties.flowProperty] -= c.uncollapsedSize;
            nextContainer.uncollapsedSize += c.uncollapsedSize;
          }

        } else {
          c.size = c.uncollapsedSize;

          if(nextSplitbar) nextSplitbar[ctrl.sizeProperties.flowProperty] += c.uncollapsedSize;
          if(nextContainer) {
            nextContainer[ctrl.sizeProperties.flowProperty] += c.uncollapsedSize;
            nextContainer.uncollapsedSize -= c.uncollapsedSize;
          }
        }
      });
      $scope.$broadcast('ui.layout.toggle', c);
      Layout.toggled();

      return c.collapsed;
    };


    /**
     * Toggles the container after the provided splitbar
     * @param splitbar
     * @returns {boolean|*|Array}
     */
    ctrl.toggleAfter = function(splitbar) {
      var index = ctrl.containers.indexOf(splitbar) + 1;
      var c = ctrl.containers[index];
      var prevSplitbar = ctrl.containers[index-1];
      var prevContainer = ctrl.containers[index-2];
      var isLastContainer = index === (ctrl.containers.length - 1);
      var endDiff;
      var flowProperty = ctrl.sizeProperties.flowProperty;
      var sizeProperty = ctrl.sizeProperties.sizeProperty;

      ctrl.bounds = $element[0].getBoundingClientRect();

      c.collapsed = !ctrl.containers[index].collapsed;

      // uncollapsedSize is undefined in case of 'auto' sized containers.
      // Perhaps there's a place where we could set... could find it though. @see also toggleBefore
      if (c.uncollapsedSize === undefined) {
        c.uncollapsedSize = c.size;
      } else {
        c.uncollapsedSize = parseInt(c.uncollapsedSize);
      }

      // FIXME: collapse:resize:uncollapse: works well "visually" without the prevSplitbar and prevContainer calculations
      // but removing those breaks few test
      $scope.$apply(function() {
        if(c.collapsed) {

          c.size = 0;

          // adds additional space so the splitbar moves to the very end of the container
          // to offset the lost space when converting from percents to pixels
          endDiff = (isLastContainer) ? ctrl.bounds[sizeProperty] - c[flowProperty] - c.uncollapsedSize : 0;

          if(prevSplitbar) {
            prevSplitbar[flowProperty] += (c.uncollapsedSize + endDiff);
          }
          if(prevContainer) {
            prevContainer.size += (c.uncollapsedSize + endDiff);
          }

        } else {
          c.size = c.uncollapsedSize;

          // adds additional space so the splitbar moves back to the proper position
          // to offset the additional space added when collapsing
          endDiff = (isLastContainer) ? ctrl.bounds[sizeProperty] - c[flowProperty] - c.uncollapsedSize : 0;

          if(prevSplitbar) {
            prevSplitbar[flowProperty] -= (c.uncollapsedSize + endDiff);
          }
          if(prevContainer) {
            prevContainer.size -= (c.uncollapsedSize + endDiff);
          }
        }
      });
      $scope.$broadcast('ui.layout.toggle', c);
      Layout.toggled();
      return c.collapsed;
    };

    /**
     * Returns the container object of the splitbar that is before the one passed in.
     * @param currentSplitbar
     */
    ctrl.getPreviousSplitbarContainer = function(currentSplitbar) {
      if(LayoutContainer.isSplitbar(currentSplitbar)) {
        var currentSplitbarIndex = ctrl.containers.indexOf(currentSplitbar);
        var previousSplitbarIndex = currentSplitbarIndex - 2;
        if(previousSplitbarIndex >= 0) {
          return ctrl.containers[previousSplitbarIndex];
        }
        return null;
      }
      return null;
    };

    /**
     * Returns the container object of the splitbar that is after the one passed in.
     * @param currentSplitbar
     */
    ctrl.getNextSplitbarContainer = function(currentSplitbar) {
      if(LayoutContainer.isSplitbar(currentSplitbar)) {
        var currentSplitbarIndex = ctrl.containers.indexOf(currentSplitbar);
        var nextSplitbarIndex = currentSplitbarIndex + 2;
        if(currentSplitbarIndex > 0 && nextSplitbarIndex < ctrl.containers.length) {
          return ctrl.containers[nextSplitbarIndex];
        }
        return null;
      }
      return null;
    };

    /**
     * Checks whether the container before this one is a split bar
     * @param  {container}  container The container to check
     * @return {Boolean}    true if the element before is a splitbar, false otherwise
     */
    ctrl.hasSplitbarBefore = function(container) {
      var index = ctrl.containers.indexOf(container);
      if(1 <= index) {
        return LayoutContainer.isSplitbar(ctrl.containers[index-1]);
      }

      return false;
    };

    // Skips splitbars
    ctrl.getPreviousContainer = function(container) {
      var index = ctrl.containers.indexOf(container);
      if (index <= 0) {
        return null;
      }

      if((index >= 2) && (LayoutContainer.isSplitbar(ctrl.containers[index-1]))) {
        return ctrl.containers[index-2];
      }

      return null;
    };

    // Skips splitbars
    ctrl.getNextContainer = function(container) {
      var index = ctrl.containers.indexOf(container);
      if ((index < 0) || (index === ctrl.containers.length-1)) {
        return null;
      }

      if((index < ctrl.containers.length-2) && (LayoutContainer.isSplitbar(ctrl.containers[index+1]))) {
        return ctrl.containers[index+2];
      }

      return null;
    };

    /**
     * Checks whether the container after this one is a split bar
     * @param  {container}  container The container to check
     * @return {Boolean}    true if the element after is a splitbar, false otherwise
     */
    ctrl.hasSplitbarAfter = function(container) {
      var index = ctrl.containers.indexOf(container);
      if(index < ctrl.containers.length - 1) {
        return LayoutContainer.isSplitbar(ctrl.containers[index+1]);
      }

      return false;
    };

    /**
     * Checks whether the passed in element is a ui-layout type element.
     * @param  {element}  element The element to check
     * @return {Boolean}          true if the element is a layout element, false otherwise.
     */
    ctrl.isLayoutElement = function(element) {
      return element.hasAttribute('ui-layout-container') ||
        element.hasAttribute('ui-splitbar') ||
        element.nodeName === 'UI-LAYOUT-CONTAINER';
    };

    /**
     * Retrieve the index of an element within it's parents context.
     * @param  {element} element The element to get the index of
     * @return {int}             The index of the element within it's parent
     */
    ctrl.indexOfElement = function(element) {
      var parent = element.parent();
      var children = parent.children();
      var containerIndex = 0;
      for(var i = 0; i < children.length; i++) {
        var child = children[i];
        if(ctrl.isLayoutElement(child)) {
          if(element[0] == children[i]) {
            return containerIndex;
          }
          containerIndex++;
        }
      }
      return -1;
    };

    return ctrl;
  }])

  .directive('uiLayout', ['$timeout', '$window', 'LayoutContainer', function($timeout, $window, LayoutContainer) {
    return {
      restrict: 'AE',
      controller: 'uiLayoutCtrl',
      scope: { flow: '@' },

      link: function(scope, element, attrs, ctrl) {

        function recalcLayout() {

          //--------------------
          // HACK: If the container is small enough then the app is resized to
          //       full screen the container will be zero in size and cannot
          //       resize itself properly.  This hack code checks for various
          //       error conditions and attempts to fix specific values.
          //
          var i;
          var numOfSplitbars = 0;

          if (!ctrl.bounds.width) {
            // layout must have been not visible then resized
            // to a larger size.  Let the controller handle this.
            return;
          }

          ctrl.bounds = element[0].getBoundingClientRect();

          for (i = 0; i < ctrl.containers.length; i++) {
            if (LayoutContainer.isSplitbar(ctrl.containers[i])) {
              numOfSplitbars++;
            }
          }

          var dividerSize = parseInt(ctrl.opts.dividerSize);
          var elementSize = element[0].getBoundingClientRect()[ctrl.sizeProperties.sizeProperty];
          var availableSize = elementSize - (dividerSize * numOfSplitbars);

          for (i = 0; i < ctrl.containers.length; i++) {
            if (!LayoutContainer.isSplitbar(ctrl.containers[i])) {
              if ((ctrl.containers[i].size <= 0) && (ctrl.containers[i].isShown)){
                if(ctrl.isPercent(ctrl.containers[i].uncollapsedSize)) {
                  ctrl.containers[i].size = ctrl.convertToPixels(ctrl.containers[i].uncollapsedSize, availableSize);
                } else {
                  ctrl.containers[i].size = parseInt(ctrl.containers[i].uncollapsedSize);
                }
                if ((isNaN(ctrl.containers[i].size)) || (ctrl.containers[i].size <= 0)) {
                  ctrl.containers[i].size = 200;
                }
              }
              if (ctrl.containers[i].maxSize === 0) {
                ctrl.containers[i].maxSize = ctrl.containers[i].size;
              }
            }
          }
          //--------------------

          ctrl.calculate();
        } // recalcLayout

        // Disable for now due to performance reasons:
        // If deemed necessary, add back in.
//      scope.$watch(function () {
//        return element[0][ctrl.sizeProperties.offsetSize];
//      }, function() {
//        ctrl.calculate();
//      });

        function onResize() {
          $timeout(function() {
              recalcLayout();
          }, 50);
        }

        // This can be used to force a recalculation/redraw.
        // This can be useful when using in a tab and the
        // first tab with a layout looks fine, then you change
        // to the other tab with a layout and it looks incorrect.
        scope.$on('$destroy', scope.$on('recalcLayout', function() {
            $timeout(function() {
              ctrl.bounds = element[0].getBoundingClientRect();
              recalcLayout();
          }, 50);
        }));

        angular.element($window).bind('resize', onResize);

        scope.$on('$destroy', function() {
          angular.element($window).unbind('resize', onResize);
          ctrl.destroy();
        });
      }
    };
  }])

  .directive('uiSplitbar', ['$timeout', 'LayoutContainer', function($timeout, LayoutContainer) {
    // Get all the page.
    var htmlElement = angular.element(document.body.parentElement);

    return {
      restrict: 'EAC',
      require: '^uiLayout',
      scope: {},

      link: function(scope, element, attrs, ctrl) {
        if(!element.hasClass('stretch')) element.addClass('stretch');
        if(!element.hasClass('ui-splitbar')) element.addClass('ui-splitbar');

        var animationClass = ctrl.isUsingColumnFlow ? 'animate-column' : 'animate-row';
        element.addClass(animationClass);

        scope.splitbar = LayoutContainer.Splitbar();
        scope.splitbar.element = element;

        scope.splitbarMoving   = false;
        scope.splitbarDebounce = { left:     null, top:     null,
                                   prevLeft: null, prevTop: null };
        //icon <a> elements
        var prevButton = angular.element(element.children()[0]);
        var afterButton = angular.element(element.children()[1]);

        //icon <span> elements
        var prevIcon = angular.element(prevButton.children()[0]);
        var afterIcon = angular.element(afterButton.children()[0]);

        //icon classes
        var iconLeft = 'ui-splitbar-icon-left';
        var iconRight = 'ui-splitbar-icon-right';
        var iconUp = 'ui-splitbar-icon-up';
        var iconDown = 'ui-splitbar-icon-down';

        var prevIconClass = ctrl.isUsingColumnFlow ? iconLeft : iconUp;
        var afterIconClass = ctrl.isUsingColumnFlow ? iconRight : iconDown;

        prevIcon.addClass(prevIconClass);
        afterIcon.addClass(afterIconClass);


        prevButton.on('click', function() {
          var prevSplitbarBeforeButton, prevSplitbarAfterButton;
          var result = ctrl.toggleBefore(scope.splitbar);
          var previousSplitbar = ctrl.getPreviousSplitbarContainer(scope.splitbar);

          if(previousSplitbar !== null) {
            prevSplitbarBeforeButton = angular.element(previousSplitbar.element.children()[0]);
            prevSplitbarAfterButton = angular.element(previousSplitbar.element.children()[1]);
          }

          if(ctrl.isUsingColumnFlow) {
            if(result) {
              afterButton.css('display', 'none');
              prevIcon.removeClass(iconLeft);
              prevIcon.addClass(iconRight);

              // hide previous splitbar buttons
              if(previousSplitbar !== null) {
                prevSplitbarBeforeButton.css('display', 'none');
                prevSplitbarAfterButton.css('display', 'none');
              }
            } else {
              afterButton.css('display', 'inline');
              prevIcon.removeClass(iconRight);
              prevIcon.addClass(iconLeft);

              // show previous splitbar icons
              if(previousSplitbar !== null) {
                prevSplitbarBeforeButton.css('display', 'inline');
                prevSplitbarAfterButton.css('display', 'inline');
              }
            }
          } else {
            if(result) {
              afterButton.css('display', 'none');
              prevIcon.removeClass(iconUp);
              prevIcon.addClass(iconDown);

              // hide previous splitbar buttons
              if(previousSplitbar !== null) {
                prevSplitbarBeforeButton.css('display', 'none');
                prevSplitbarAfterButton.css('display', 'none');
              }
            } else {
              afterButton.css('display', 'inline');
              prevIcon.removeClass(iconDown);
              prevIcon.addClass(iconUp);

              // show previous splitbar icons
              if(previousSplitbar !== null) {
                prevSplitbarBeforeButton.css('display', 'inline');
                prevSplitbarAfterButton.css('display', 'inline');
              }
            }
          }
          scope.$evalAsync(function() {
            ctrl.calculate();
          });
        });

        afterButton.on('click', function() {
          var nextSplitbarBeforeButton, nextSplitbarAfterButton;
          var result = ctrl.toggleAfter(scope.splitbar);
          var nextSplitbar = ctrl.getNextSplitbarContainer(scope.splitbar);

          if(nextSplitbar !== null) {
            nextSplitbarBeforeButton = angular.element(nextSplitbar.element.children()[0]);
            nextSplitbarAfterButton = angular.element(nextSplitbar.element.children()[1]);
          }

          if(ctrl.isUsingColumnFlow) {
            if(result) {
              prevButton.css('display', 'none');
              afterIcon.removeClass(iconRight);
              afterIcon.addClass(iconLeft);

              // hide next splitbar buttons
              if(nextSplitbar !== null) {
                nextSplitbarBeforeButton.css('display', 'none');
                nextSplitbarAfterButton.css('display', 'none');
              }
            } else {
              prevButton.css('display', 'inline');
              afterIcon.removeClass(iconLeft);
              afterIcon.addClass(iconRight);

              // show next splitbar buttons
              if(nextSplitbar !== null) {
                nextSplitbarBeforeButton.css('display', 'inline');
                nextSplitbarAfterButton.css('display', 'inline');
              }
            }
          } else {
            if(result) {
              prevButton.css('display', 'none');
              afterIcon.removeClass(iconDown);
              afterIcon.addClass(iconUp);

              // hide next splitbar buttons
              if(nextSplitbar !== null) {
                nextSplitbarBeforeButton.css('display', 'none');
                nextSplitbarAfterButton.css('display', 'none');
              }
            } else {
              prevButton.css('display', 'inline');
              afterIcon.removeClass(iconUp);
              afterIcon.addClass(iconDown);

              // show next splitbar buttons
              if(nextSplitbar !== null) {
                nextSplitbarBeforeButton.css('display', 'inline');
                nextSplitbarAfterButton.css('display', 'inline');
              }
            }
          }
          scope.$evalAsync(function() {
            ctrl.calculate();
          });
        });

        element.on('mousedown touchstart', function(e) {
          ctrl.movingSplitbar = scope.splitbar;
          ctrl.processSplitbar(scope.splitbar);

          e.preventDefault();
          e.stopPropagation();

          // Track that we are moving the splitbar
          scope.splitbarMoving = true;

          htmlElement.on('mousemove touchmove', function(event) {
            scope.$apply(angular.bind(ctrl, ctrl.mouseMoveHandler, event));
          });
          return false;
        });

        htmlElement.on('mouseup touchend', function(event) {
          // Clear that we are moving the splitbar
          scope.splitbarMoving = false;

          scope.$apply(angular.bind(ctrl, ctrl.mouseUpHandler, event));
          htmlElement.off('mousemove touchmove');
        });

        scope.$on( '$destroy', scope.$watch('splitbar.size', function(newValue) {
          element.css(ctrl.sizeProperties.sizeProperty, newValue + 'px');
        }));

        scope.$on( '$destroy', scope.$watch('splitbar.left', function(newValue) {
          var timeOut = (newValue === 0) ? 100 : 50;
          if ((angular.isUndefined(newValue)) ||
              (scope.splitbarDebounce.prevLeft === newValue)) {
            return;
          }
          scope.splitbarDebounce.prevLeft = newValue;

          if (scope.splitbarDebounce.left) {
            $timeout.cancel(scope.splitbarDebounce.left);
          }

          // If we are moving the splitbar, keep it reactive
          if (scope.splitbarMoving) {
            element.css('left', newValue + 'px');
            scope.splitbarDebounce.left = null;
            return;
          }

          scope.splitbarDebounce.left = $timeout(function(val) {
            element.css('left', val + 'px');
            scope.splitbarDebounce.left = null;
          }, timeOut, true, newValue);
        }));

        scope.$on( '$destroy', scope.$watch('splitbar.top', function(newValue) {
          var timeOut = (newValue === 0) ? 100 : 50;
          if ((angular.isUndefined(newValue)) ||
              (scope.splitbarDebounce.prevTop === newValue)) {
            return;
          }
          scope.splitbarDebounce.prevTop = newValue;

          if (scope.splitbarDebounce.top) {
            $timeout.cancel(scope.splitbarDebounce.top);
          }

          // If we are moving the splitbar, keep it reactive
          if (scope.splitbarMoving) {
            element.css('top', newValue + 'px');
            scope.splitbarDebounce.top = null;
            return;
          }

          scope.splitbarDebounce.top = $timeout(function(val) {
            element.css('top', val + 'px');
            scope.splitbarDebounce.top = null;
          }, timeOut, true, newValue);
        }));

        scope.$on('$destroy', function() {
          htmlElement.off('mouseup touchend mousemove touchmove');
        });

        //Add splitbar to layout container list
        ctrl.addContainer(scope.splitbar);

        element.on('$destroy', function() {
          ctrl.removeContainer(scope.splitbar);
          scope.$evalAsync();
        });
      }
    };

  }])

  .directive('uiLayoutContainer',
    ['LayoutContainer', '$compile', '$timeout', 'Layout',
      function(LayoutContainer, $compile, $timeout, Layout) {
        return {
          restrict: 'AE',
          require: '^uiLayout',
          scope: {
            collapsed: '=',
            resizable: '=',
            size: '@',
            minSize: '@',
            maxSize: '@',
            showContainer: '@'
          },

          compile: function() {
            return {
              pre: function(scope, element, attrs, ctrl) {

                scope.container = LayoutContainer.Container();
                scope.container.element = element;
                scope.container.id = element.attr('id') || null;
                scope.container.layoutId = ctrl.id;
                scope.container.isCentral = attrs.uiLayoutContainer === 'central';

                if (scope.collapsed === true) {
                  scope.collapsed = false;
                  Layout.addCollapsed(scope.container);
                }
                // FIXME: collapsed: @see uiLayoutLoaded for explanation
                //if (angular.isDefined(scope.collapsed)) {
                //  scope.container.collapsed = scope.collapsed;
                //}

                if (angular.isDefined(scope.resizable)) {
                  scope.container.resizable = scope.resizable;
                }
                scope.container.size = scope.size;
                scope.container.uncollapsedSize = scope.size;
                scope.container.minSize = scope.minSize;
                scope.container.maxSize = scope.maxSize;
                ctrl.addContainer(scope.container);

                element.on('$destroy', function() {
                  ctrl.removeContainer(scope.container);
                  scope.$evalAsync();
                });
              },
              post: function(scope, element, attrs, ctrl) {

                function _showContainer(val) {
                  if (ctrl.opts.dividerSize > 0) {
                    // Hiding
                    ctrl.opts.dividerSizePrev = ctrl.opts.dividerSize;
                    ctrl.opts.dividerSize = 0;
                    scope.container.uncollapsedSize = element.css(ctrl.sizeProperties.sizeProperty);
                    scope.container.isShown = false;
                  }
                  else {
                    // Showing
                    ctrl.opts.dividerSize = ctrl.opts.dividerSizePrev;
                    scope.container.isShown = true;
                  }

                  ctrl.calculate();
                  ctrl.toggleContainer(scope.container.index);
                }

                if(!element.hasClass('stretch')) element.addClass('stretch');
                if(!element.hasClass('ui-layout-container')) element.addClass('ui-layout-container');

                var animationClass = ctrl.isUsingColumnFlow ? 'animate-column' : 'animate-row';
                element.addClass(animationClass);

                scope.$on( '$destroy', scope.$watch('collapsed', function (val, old) {
                  if (angular.isDefined(old) && val !== old) {
                    ctrl.toggleContainer(scope.container.index);
                  }
                }));

                scope.$on( '$destroy', scope.$watch('container.size', function(newValue) {
                  if (angular.isUndefined(newValue)) {
                    return;
                  }
                  element.css(ctrl.sizeProperties.sizeProperty, newValue + 'px');
                  if(newValue === 0) {
                    element.addClass('ui-layout-hidden');
                  } else {
                    element.removeClass('ui-layout-hidden');
                  }
                }));

                scope.$on( '$destroy', scope.$watch('container.left', function(newValue) {
                  if (angular.isUndefined(newValue)) {
                    return;
                  }
                  element.css('left', newValue + 'px');
                }));

                scope.$on( '$destroy', scope.$watch('container.top', function(newValue) {
                  if (angular.isUndefined(newValue)) {
                    return;
                  }
                  element.css('top', newValue + 'px');
                }));

                scope.$on( '$destroy', scope.$watch('showContainer', function(val, old) {
                  if (val === old) {
                    return;
                  }
                  _showContainer(val);
                }));

                if (scope.showContainer === "false") {
                  $timeout(function(){
                    _showContainer(false);
                  }, 50, false);
                }

                //TODO: add ability to disable auto-adding a splitbar after the container
                var parent = element.parent();
                var children = parent.children();
                var index = ctrl.indexOfElement(element);
                var splitbar = angular.element('<div ui-splitbar>' +
                  '<a><span class="ui-splitbar-icon"></span></a>' +
                  '<a><span class="ui-splitbar-icon"></span></a>' +
                  '</div>');
                if(0 < index && !ctrl.hasSplitbarBefore(scope.container)) {
                  angular.element(children[index-1]).after(splitbar);
                  $compile(splitbar)(scope);
                } else if(index < children.length - 1) {
                  element.after(splitbar);
                  $compile(splitbar)(scope);
                }
              }
            };
          }
        };
      }])

  .directive('uiLayoutLoaded', ['$timeout', 'Layout', function($timeout, Layout) {
    // Currently necessary for programmatic toggling to work with "initially" collapsed containers,
    // because prog. toggling depends on the logic of prevButton and nextButton (which should be probably refactored out)
    //
    // This is how it currently works:
    // 1. uiLayoutContainer in prelink phase resets @collapsed to false, because layout has to be calculated
    //    with all containers uncollapsed to get the correct dimensions
    // 2. layout with ui-layout-loaded attributes broadcasts "ui.layout.loaded"
    // 3. user changes values of @collapsed which triggers 'click' on either of the buttons
    // 3. the other button is hidden and container size set to 0
    return {
      require: '^uiLayout',
      restrict: 'A',
      priority: -100,
      link: function($scope, el, attrs){

        // negation is safe here, because we are expecting non-empty string
        if (!attrs['uiLayoutLoaded']) {
          Layout.toggle().then(
            function(){
              $scope.$broadcast('ui.layout.loaded', null);
            }
          );
        } else {
          $scope.$broadcast('ui.layout.loaded',  attrs['uiLayoutLoaded']);
        }
      }
    };
  }])

  .factory('Layout', ['$q', '$timeout', function($q, $timeout) {
    var layouts = [],
      collapsing = [],
      toBeCollapsed = 0,
      toggledDeffered =  null,
      layoutId = 0;

    function toggleContainer(container) {
      try {
        layouts[container.layoutId].toggleContainer(container.index);
      } catch (e) {
        e.message = 'Could not toggle container [' + container.layoutId + '/' + container.index + ']: ' + e.message;
        throw e;
      }
    }

    return {
      addLayout: function (ctrl) {
        ctrl.id = layoutId++;
        layouts.push(ctrl);
        return function() {
            layouts.splice(layouts.indexOf(ctrl), 1);
        };
      },
      addCollapsed: function(container) {
        collapsing.push(container);
      },
      hasCollapsed: function() {
        return collapsing.length > 0;
      },
      toggled: function() {
        // event already dispatched, do nothing
        if (toBeCollapsed === 0) {
          if (toggledDeffered) {
            toggledDeffered.reject();
          } else {
            return false;
          }
        }
        toBeCollapsed--;
        if (toBeCollapsed === 0) {
          toggledDeffered.resolve();
        }
      },
      toggle: function() {
        toggledDeffered = $q.defer();
        toBeCollapsed = collapsing.length;
        if (toBeCollapsed === 0) {
          $timeout(function(){
            toggledDeffered.resolve();
          });
        }
        collapsing.reverse();
        var c;
        while(c = collapsing.pop()) {
          toggleContainer(c);
        }
        return toggledDeffered.promise;
      }
    };
  }])

  .factory('LayoutContainer', function() {
    function BaseContainer() {

      /**
       * Stores element's id if provided
       * @type {string}
       */
      this.id = null;

      /**
       * Id of the parent layout
       * @type {number}
       */
      this.layoutId = null;

      /**
       * Central container that is always resized
       * @type {boolean}
       */
      this.isCentral = false;

      /**
       * actual size of the container, which is changed on every updateDisplay
       * @type {any}
       */
      this.size = 'auto';

      /**
       * cache for the last uncollapsed size
       * @type {any}
       */
      this.uncollapsedSize = null;

      this.maxSize = null;
      this.minSize = null;
      this.resizable = true;
      this.element = null;
      this.collapsed = false;
      this.isShown = true;
    }

    // Splitbar container
    function SplitbarContainer() {
      this.size = 10;
      this.left = 0;
      this.top = 0;
      this.element = null;
    }

    return {
      Container: function(initialSize) {
        return new BaseContainer(initialSize);
      },
      Splitbar: function() {
        return new SplitbarContainer();
      },
      isSplitbar: function(container) {
        return container instanceof SplitbarContainer;
      }
    };
  })
;
