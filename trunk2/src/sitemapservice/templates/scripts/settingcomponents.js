// Copyright 2007 Google Inc.
// All Rights Reserved.

/**
 * @fileoverview
 *
 * When saving to the XML document, we store simple setting components' value
 * as the XML element's attribute. In addition the settings for each
 * website, there is a single Global Setting which is treated as the default
 * values of all the site settings. So the site setting can omit one special
 * attribute if it has the same value as Global Setting, we name this
 * 'inheritance'.
 *
 *
 * @author chaiying@google.com
 */
//////////// Class SpaceConvertComponent /////////////////
/**
 * @constructor
 * @param {String} htmlId  The HTML id of the element
 */
function SpaceConvertComponent(htmlId) {
  this.html_ = Util.checkElemExistAndReturn(htmlId);
  this.html_.settingComp_ = this;
}

/**
 * Deal with the change of the listening target component.
 * @param {SettingComponent} comp  The listening target component
 * @param {ListenerManager.listenTypes} type  The type of listening
 */
SpaceConvertComponent.prototype.listeningCallback = function(comp, type) {
  // Changes this component's value according to the target component's value. 
  if (type == ListenerManager.listenTypes.SPACECONVERT) {
    var value = 
        comp.getValueFromHTML_() * URL_RECORD_SIZE_INBYTES / 1024 / 1024;
    this.setValueToHTML_(value.toFixed(2));
  }
};

/**
 * Sets value to HTML.
 * @param {String} value  The value sent to HTML
 * @private
 */
SpaceConvertComponent.prototype.setValueToHTML_ = function(value) {
  this.html_.value = value;
};


//////////// Class SettingComponent /////////////////
/**
 * @constructor
 * @param {String?} xpath  The xpath of the setting XML element/attribute
 * @param {String?} htmlId  The id of the setting HTML element
 * @param {Object?} opt_flags  Some component type flags
 */
function SettingComponent(xpath, htmlId, opt_flags) {
  if (arguments[0] == 'inheritsFrom') {
    // called by inheritsFrom function
    return;
  }
  
  /**
   * @type {String}
   */
  this.xpath_ = xpath;

  /**
   * @type {String}
   */
  this.name_ = XmlManager.getAttrNameFromXpath(xpath);

  /**
   * @type {Boolean}
   */
  this.isInherited_ = false;

  /**
   * @type {SettingComponent?}
   */
  this.global_ = null;

  /**
   * @type {XmlManager?}
   */
  this.xml_ = null;

  /**
   * For 'admin_name', it will be null
   * @type {String?}
   */
  this.htmlId_ = htmlId;

  /**
   * @type {Element?}
   */
  this.html_ = null;

  /**
   * @type {AccessManager}
   */
  this.access_ = new AccessManager();

  /**
   * @type {ListenerManager}
   */
  this.listenerMng_ = new ListenerManager(this);

  /**
   * @type {Object} store the flags for the component type
   */
  this.flags_ = {};
  /**
   * @type {Boolean} default is false
   */
  this.flags_.isSiteSpecial_ = (opt_flags && opt_flags.isSiteSpecial != null) ?
                               opt_flags.isSiteSpecial : false;
}

/**
 * Checks if the setting is site special setting (the setting that has different
 * value for each site, not exist in global setting)
 * @return {Boolean} If the setting is site special 
 */
SettingComponent.prototype.isSiteSpecial = function() {
  return this.flags_.isSiteSpecial_;
};

/**
 * Regists some listening component to this component. Once the component's 
 * value is changed, the listening components will be informed.
 * @param {SettingComponent} comp  The listening component
 * @param {ListenerManager.listenTypes} type  The type of listening
 */
SettingComponent.prototype.registListener = function(comp, type) {
  this.listenerMng_.regist(comp, type);
};

/**
 * Gets the name of the setting component.
 * @return {String} The name of the component
 */
SettingComponent.prototype.name = function() {
  return this.name_;
};

/**
 * Checks if the setting is inherited from global setting.
 * @return {Boolean} If the setting i s inherited
 */
SettingComponent.prototype.isInherited = function() {
  return this.isInherited_;
};

/**
 * Sets the global setting component for this component.
 * @param {SettingComponent?} global  The inherit target of this
 * setting component
 */
SettingComponent.prototype.setGlobal = function(global) {
  this.global_ = global;
};

/**
 * Sets the inherit relationship of this component.
 * @param {Boolean} isInherited  Is inherited or not
 */
SettingComponent.prototype.setInherit = function(isInherited) {
  if (this.global_ == null)
    return;  // no global to inherit

  if (this.isInherited_ == isInherited)
    return;  // nothing to do

  // trigger the inheritance
  this.isInherited_ = isInherited;

  if (isInherited) {
    // update the value
    this.setValueToHTML_(this.global_.getValueFromXML_());
  } else {
    // do the validation in case the value is inherited from the global setting.
    //this.validate();  // don't do it since the inherited value is always right
  }

  // update the access since the inheritance has changed
  this.setAccess(isInherited, 'setInherit');
};

/**
 * Loads value from XML and set it to HTML.
 * @param {XmlManager} xml  The xml node of the context setting
 */
SettingComponent.prototype.load = function(xml) {
  if (xml)
    this.xml_ = xml;
  // since we may share one html element between two components, so we should
  // switch the owner each time change the site showing
  if (this.html_)
    this.html_.settingComp_ = this;
  this.isInherited_ = null;
  this.setValueToHTML_(this.getValueFromXML_());
  this.listenerMng_.inform();
};

/**
 * Saves value from HTML to XML.
 */
SettingComponent.prototype.save = function() {
  if (this.isInherited_) {
    // remove the value in the XML
    if (!this.isSiteSpecial()) {
      this.removeValueInXML_();
    }
  } else {
    if (this.htmlId_ != null) {// readonly setting, don't need save
      this.setValueToXML_(this.getValueFromHTML_());
    }
  }
};

/**
 * Deal with the change of the listening target component.
 * @param {SettingComponent} comp  The listening target component
 * @param {ListenerManager.listenTypes} type  The type of listening
 */
SettingComponent.prototype.listeningCallback = function(comp, type) {
  // Changes this component's access right according to the target component's 
 	// value.
  if (type == ListenerManager.listenTypes.ACCESSCONTROL) {
    this.setAccess(!(comp.getValueFromHTML_()), comp.html_.id);
  }
};

//////////// Class SimpleSettingComponent /////////////////
/**
 * For single text and boolean setting.
 * @constructor
 * @param {String?} xpath  The xpath of the setting XML element/attribute
 * @param {String?} htmlId  The id of the setting HTML element
 * @param {SimpleSettingComponent.types} type  The value type of the setting
 * @param {ValidateManager?} opt_validator  The validator of the setting
 * @param {Object?} opt_flags  Some component type flags
 */
function SimpleSettingComponent(xpath, htmlId, type, opt_validator, opt_flags) {
  if (arguments[0] == 'inheritsFrom') {
    // called by inheritsFrom function
    return;
  }

  SimpleSettingComponent.prototype.parent.constructor.call(
      this, xpath, htmlId, opt_flags);
  /**
   * @type {SimpleSettingComponent.types}
   */
  this.type_ = type;  
  
  /**
   * @type {ValidateManager?}
   */
  this.validator_ = opt_validator;
}
SimpleSettingComponent.inheritsFrom(SettingComponent);

/**
 * The value types of the simple setting.
 * @enum
 */
SimpleSettingComponent.types = {BOOLEAN: 1, STRING: 2, DURATION: 3, 
                                SPACESIZE: 4};

/**
 * Removes the setting value in XML.
 * @private
 */
SimpleSettingComponent.prototype.removeValueInXML_ = function() {
  this.xml_.removeAttributeByXpath(this.xpath_);
};

/**
 * focus to this setting.
 */
SimpleSettingComponent.prototype.focus = function() {
  if (!this.initHtml_()) {
    return;
  }
  try {
    this.html_.focus();
  } catch(e) {
  }
};

/**
 * Gets setting value from XML.
 * @return {Boolean|String|null} The setting value
 * @private
 */
SimpleSettingComponent.prototype.getValueFromXML_ = function() {
  var name = this.name_;
  var type = this.type_;
  function preprocess(val) {
    if (val == null) {
      // The special setting that can be appear in XML after user first set it
      if (name == 'host' || name == 'log_path') {
        return '';
      } else {
        return null;
      }
    }

    switch (type) {
      case SimpleSettingComponent.types.BOOLEAN:
        return val == 'true';
      case SimpleSettingComponent.types.DURATION:
        return parseInt(val) / 60; // seconds to minutes
      case SimpleSettingComponent.types.SPACESIZE:
        return parseInt(val) / 1024; // BYTES to KBYTES
      default:
        return val;
    }
  }

  var value;
  if (this.isInherited_ == null) { // first load
    // get value from xml
    value = preprocess(this.xml_.getAttributeByXpath(this.xpath_));

    // if not found, get value from global
    if (value == null) {
      this.isInherited_ = true;
      value = this.global_.getValueFromXML_();
    } else {
      this.isInherited_ = false;
    }
    // update the access since the inheritance has changed
    this.setAccess(this.isInherited_, 'setInherit');
  } else if (this.isInherited_) {
    value = this.global_.getValueFromXML_();
  } else {
    value = preprocess(this.xml_.getAttributeByXpath(this.xpath_));
    // copy on write: the component is set to customize, but the value never
    // change
    if (value == null && this.global_ != null)
      value = this.global_.getValueFromXML_();
  }
  return value;
};

/**
 * Sets the setting value to XML.
 * @param {Boolean|String} value  The value of the setting
 * @private
 */
SimpleSettingComponent.prototype.setValueToXML_ = function(value) {

  if (this.isInherited_)
    return;

  switch (this.type_) {
    case SimpleSettingComponent.types.BOOLEAN:
      value = value ? 'true' : 'false';
      break;
    case SimpleSettingComponent.types.DURATION:
      value = parseInt(value) * 60; // minutes to seconds
      break;
    case SimpleSettingComponent.types.SPACESIZE:
      value = parseInt(value) * 1024; // KBYTES to BYTES
      break;
  }

  this.xml_.setAttributeByXpath(this.xpath_, value);
};

/**
 * Checks if the setting value is valid.
 * @return {Boolean} If the setting value is valid
 */
SimpleSettingComponent.prototype.validate = function() {
  if (!this.validator_) {
    return true;
  }    
  if (!this.initHtml_()) {
    return true; // return true is acceptable since the value will not be
                 // changed to invalid value
  }
  if (this.isInherited_) {
    return true; // don't check the inherited value, since the inherited value
                 // will not be saved.
  }
  return this.validator_.check(this.html_);
};

/**
 * Finds the HTML element and bind it to the setting component.
 * One HTML element may shared by multiple setting components.
 * @private
 */
SimpleSettingComponent.prototype.initHtml_ = function() {
  if (!this.htmlId_)
    return false;

  if (!this.html_) {
    this.html_ = Util.checkElemExistAndReturn(this.htmlId_);

    // Init the HTML element if it has not been inited by other settting
    // component.
    var needInit = this.html_.settingComp_ == null;

    // set the owner
    this.html_.settingComp_ = this;

    // Init the HTML element
    if (needInit) {
      // add onchange function for inputs
      Util.event.add(this.html_, 'change', function(e, target){
        if (!target.settingComp_.validate()) {
          alert(VALIDATING_FAIL_MSG);
          return;
        }
        target.settingComp_.listenerMng_.inform();
      });

      if (this.html_.type == 'checkbox') {
        // add click warning for robots-included setting
        switch (this.htmlId_) {
          case 'robotsIncluded':
            Util.event.add(this.html_, 'click', function(e, target){
              if (target.checked && !confirm(ROBOTS_INCLUDE_CONFIRM_MSG)) {
                target.checked = false;
              }
            });
            break;
          case 'siteEnabled':
            Util.event.add(this.html_, 'click', function(e, target){
              if (SiteSettings.getInstance().site().isWebServerFilterEnabled())
                  if (!confirm(NEED_RESTART_WEBSERVER_CONFIRM_MSG)) {
                    target.checked = !target.checked;
                  }
            });
            break;
          case 'webserverFilterEnabled':
            Util.event.add(this.html_, 'click', function(e, target){
              if (SiteSettings.getInstance().site().isEnabled() &&
                  !confirm(NEED_RESTART_WEBSERVER_CONFIRM_MSG)) {
                target.checked = !target.checked;
              }
            });
            break;
          case 'newsEnabled':
            Util.event.add(this.html_, 'click', function(e, target){
              if (target.checked)
                alert(NEWS_ENABLE_MSG);
            });
            break;
        }

        // add click handler of checkbox for 
        // ListenerManager.listenTypes.ACCESSCONTROL
        var listeners = this.listenerMng_.listeners(
            ListenerManager.listenTypes.ACCESSCONTROL);
        if (listeners != null && listeners.length > 0) {
          Util.event.add(this.html_, 'click', function(e, target){
            target.settingComp_.listenerMng_.inform();
          });
        }
      }
    }

  }

  return true;
};

/**
 * Sets setting value to HTML.
 * @param {Boolean|String} value  The setting value
 * @private
 */
SimpleSettingComponent.prototype.setValueToHTML_ = function(value) {
  if (!this.initHtml_()) {
    return;
  }

  switch (this.type_) {
    case SimpleSettingComponent.types.BOOLEAN:
      this.html_.checked = value;
      break;
    case SimpleSettingComponent.types.STRING:
    case SimpleSettingComponent.types.DURATION:
    case SimpleSettingComponent.types.SPACESIZE:
      this.html_.value = value;
      break;
    default:debugger;
      Util.console.error('Invalid setting component type');
  }


  Util.CSS.removeClass(this.html_, INPUT_INVALID_CSS_CLASS);
};

/**
 * Gets setting value from HTML.
 * @return {Boolean|String} The setting value
 * @private
 */
SimpleSettingComponent.prototype.getValueFromHTML_ = function() {
  if (!this.initHtml_()) {
    return null;
  }

  switch (this.type_) {
    case SimpleSettingComponent.types.BOOLEAN:
      return this.html_.checked;
    case SimpleSettingComponent.types.STRING:
    case SimpleSettingComponent.types.DURATION:
    case SimpleSettingComponent.types.SPACESIZE:
      return this.html_.value;
    default:debugger;
      Util.console.error('Invalid setting component type');
      return null;
  }
};

/**
 * Sets access right to the setting, since there are more than one reason to set
 * the access right, we must record the reason.
 * @param {Boolean} readonly  If the setting is readonly
 * @param {String} reason  The reason to set the access right
 */
SimpleSettingComponent.prototype.setAccess = function(readonly, reason) {
  if (!this.initHtml_()) {
    return;
  }
  this.access_.set(readonly, reason);
  AccessManager.setAccessToElem(this.access_, this.html_);
};


//////////// Class CustomizeSettingComponent /////////////////
/**
 * For the customize checkbox setting on each tab,
 * inherit from SimpleSettingComponent.
 * @param {String?} htmlId  The id of the setting HTML element
 * @param {SiteSetting|SitemapSetting} owner  The setting which owns this 
 * component
 */
function CustomizeSettingComponent(htmlId, owner) {
  this.parent.constructor.call(this, 'customizeComponent', htmlId, null,
                               SimpleSettingComponent.types.BOOLEAN);
  this.owner_ = owner;
}
CustomizeSettingComponent.inheritsFrom(SimpleSettingComponent);

/**
 * Initialize the HTML element of this setting.
 * @private
 */
CustomizeSettingComponent.prototype.initHtml_ = function() {
  if (this.html_ == null) {
    if (!this.parent.initHtml_.call(this)) {
      return false;
    }

    var that = this;
    Util.event.add(this.html_, 'click', function() {
      if (that.html_.checked == true) {
        // if user want sync to global, confirm it.
        if (!confirm(CANCEL_CUSTOMIZE_SETTING_MSG)) {
          that.html_.checked = false;
        } else {
          // uncustomize tab
          that.owner_.setInherit(true);
          PageManager.getInstance().adjustPageHeight();
        }
      } else {
        // customize tab
        that.owner_.setInherit(false);
      }
    });
  }
  return true;
};

/**
 * Sets value to HTML (since it has no direct XML value).
 *
 * The component's loading will affect the inherit property of the whole setting
 * group (the owner of the customize setting).
 * 
 * @param {Boolean} value  The value of this setting
 */
CustomizeSettingComponent.prototype.load = function(value) {
  if (value == null)
    return; // normal load process

  this.setValueToHTML_(value);
  this.owner_.setInherit(value);
};

/**
 * Saves setting value to the XML node
 */
CustomizeSettingComponent.prototype.save = function() {
  // do nothing, keep it to override the parent function
};

/**
 * Since it has no global setting, this function only set the inherit property
 * to its HTML value.
 * @param {Boolean} isInherited  The inherit property value
 */
CustomizeSettingComponent.prototype.setInherit = function(isInherited) {
  this.setValueToHTML_(isInherited);
};

//////////// Class ListTplParamSet /////////////////
/**
 * @constructor
 * @param {String} containerTag  The XML tag of the list node
 * @param {String} lineTag  The XML tag of the list item node
 * @param {Array.<String>} attributesTags  The XML tags of the list item 
 */
function ListTplParamSet(containerTag, lineTag, attributesTags) {
  this.container_ = containerTag;
  this.line_ = lineTag;
  this.attributes_ = attributesTags;
}
/**
 * Gets the XML tag of the list node.
 * @return {String} The XML tag of the list node
 */
ListTplParamSet.prototype.container = function() {
  return this.container_;
};
/**
 * Gets the XML tag of the list item node.
 * @return {String} The XML tag of the list item node
 */
ListTplParamSet.prototype.line = function() {
  return this.line_;
};
/**
 * Gets one XML tag of the list item attributes.
 * @param {Number} index  The index of the attribute
 * @return {String} The XML tag of the indexed attribute
 */
ListTplParamSet.prototype.attr = function(index) {
  if (index < 0 || index > this.attributes_.length)
    return null;
  return this.attributes_[index];
};
/**
 * Gets the XML tags of the list item attributes.
 * @return {String} The XML tags of the list item attributes.
 */
ListTplParamSet.prototype.attributes = function() {
  return this.attributes_;
};
//////////// Class ListSettingComponent /////////////////
/**
 * For List setting.
 * @constructor
 * @param {String} xpath  The xpath of the setting XML element/attribute
 * @param {String} htmlId  The id of the setting HTML element
 */
function ListSettingComponent(xpath, htmlId) {
  this.parent.constructor.call(this, xpath, htmlId, null);
  /**
   * @type {ListTplParamSet}
   */
  this.listTplParamSet_ = ListSettingComponent.getListTplParamSet_(this.xpath_);
}
ListSettingComponent.inheritsFrom(SettingComponent);

/**
 * The XML tags for different types of lists.
 * @enum {Object}
 * @private
 */
ListSettingComponent.lists_ = {
  UrlReplacements: new ListTplParamSet(
      'UrlReplacements', 'UrlReplacement', ['find', 'replace']),
  IncludedUrls: new ListTplParamSet('IncludedUrls', 'Url', ['value']),
  ExcludedUrls: new ListTplParamSet('ExcludedUrls', 'Url', ['value']),
  NotifyUrls: new ListTplParamSet('NotifyUrls', 'Url', ['value'])
};

/**
 * Gets one list tag set
 * @param {String} listName  The list tag set name
 * @return {ListTplParamSet} The list tag set
 * @private
 */
ListSettingComponent.getListTplParamSet_ = function(listName) {
  for (var listname in ListSettingComponent.lists_) {
    var list = ListSettingComponent.lists_[listname];
    if (list.container() == listName)
      return list;
  }
  return null;
};

/**
 * Removes the list from XML.
 * @private
 */
ListSettingComponent.prototype.removeValueInXML_ = function() {
  this.xml_.removeNodeByXpath(this.listTplParamSet_.container());
};

/**
 * Saves the setting value to XML.
 * @param {Array.<Array.<String>>} value  The setting value of this list
 * @private
 */
ListSettingComponent.prototype.setValueToXML_ = function(value) {
  if (this.isInherited_)
    return;

  // generate listNode if necessary
  // set always after the get, so if the this.listNode_ is null, it means
  // no node in XML.
  if (this.listNode_ == null) {
    this.listNode_ = XmlManager.createElement(this.listTplParamSet_.container());

    // add separator too
    var separator = this.xml_.generateSeparator(XML_FILE_INDENT);
    this.xml_.appendNodeWithSeparator(this.listNode_, separator);
  }

  // remove the old listItems
  Util.DOM.removeAllChildren(this.listNode_);

  // save listValue into listNode
  var listValue = value;
  var separator = this.xml_.generateSeparator(this.listNode_, XML_FILE_INDENT);
  for (var i = 0; i < listValue.length; i++) {
    this.listNode_.appendChild(separator.cloneNode(true));
    var listItem =
        XmlManager.createElement(this.listTplParamSet_.line());

    Util.array.applyToMultiple(this.listTplParamSet_.attributes(), listValue[i], 
        function(attr, value) {
          listItem.setAttribute(attr, value);
        });

    this.listNode_.appendChild(listItem);
  }

  var lastSeparator = this.xml_.generateSeparator(this.listNode_, '');
  this.listNode_.appendChild(lastSeparator.cloneNode(true));
};

/**
 * Gets setting value from XML.
 * @return {Array.<Array.<String>>?} The setting value of this list
 * @private
 */
ListSettingComponent.prototype.getValueFromXML_ = function() {
  var value;
  // check the this.isInherited_ first to reduce the load from XML
  if (this.isInherited_ == null) { // from load
    this.listNode_ = (function findFirst(dom, tag) {
      var nodes = dom.getElementsByTagName(tag);
      if (!nodes)
        return null;
      return nodes[0];
    })(this.xml_.dom(), this.listTplParamSet_.container());

    if (this.listNode_ == null) {
      // get from global
      this.isInherited_ = true;
      value = this.global_.getValueFromXML_();
    } else {
      // get from local XML
      this.isInherited_ = false;
      value = this.getXmlAttrValues_();
    }
    // update the access since the inheritance has changed
    this.setAccess(this.isInherited_, 'setInherit');
  } else if (this.isInherited_) {
    value = this.global_.getValueFromXML_();
  } else {
    // we load first, so if this.listNode_ is null, it means no node in XML
    if (this.listNode_ == null) {
      // copy on write: the component is set to customize, but the value never
      // change
      value = this.global_.getValueFromXML_();
    } else {
      value = this.getXmlAttrValues_();
    }
  }
  return value;
};

/**
 * Extracts all the attributes' values in the XML list items.
 * @return {Array.<Array.<String>>?} The setting value of this list
 * @private
 */
ListSettingComponent.prototype.getXmlAttrValues_ = function() {
  /**
   * @type {Array.<Element>} The XML elements
   */
  var elements =
      this.listNode_.getElementsByTagName(this.listTplParamSet_.line());
  /**
   *
   * @type {Array.<String>} Array that contains the attributes'
   *     names that need to extract
   */
  var attrNameArray = this.listTplParamSet_.attributes();
  var attrVals = [];
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    attrVals[i] = [];
    for (var j = 0; j < element.attributes.length; j++) {
      var attribute = element.attributes[j];
      if (Util.array.contains(attrNameArray, attribute.name))
        attrVals[i].push(element.getAttribute(attribute.name));
    }
  }
  return attrVals;
};
/**
 * Initializes the HTML element of this list.
 * @private
 */
ListSettingComponent.prototype.initHtml_ = function() {
  if (!this.html_) {
    this.html_ = new DynamicInputList(this.htmlId_, this);
    // validate the list inputs only when the input change
    this.html_.addEvent('change', function(e, input) {
      if (!input.ownerField_.validator().check(input)) {
        alert(VALIDATING_FAIL_MSG);
        return;
      }
      // up to now no binds for list setting
      //that.listenerMng_.inform();
    });
  }
  return true;
};

/**
 * Sets setting value to HTML.
 * @param {Array.<Array.<String>>} value  The setting value of this list
 * @private
 */
ListSettingComponent.prototype.setValueToHTML_ = function(value) {
  this.initHtml_();

  /**
   * @type {Array.<Array.<String>>}
   */
  this.html_.setValue(value, this.access_);
};

/**
 * Gets setting value from HTML.
 * @return {Array.<Array.<String>>?} The setting value of this list
 * @private
 */
ListSettingComponent.prototype.getValueFromHTML_ = function() {
  this.initHtml_();
  return this.html_.getValue();
};

/**
 * Prints the content of this object.
 * @return {String} The string representation of this object
 */
ListSettingComponent.prototype.toString = function() {
  this.initHtml_();
  var str = this.xpath_ + '(List): ';
  var values = this.html_.getValue();
  Util.array.apply(values, function(value) {
    str += 'Item:\n';
    Util.array.apply(value, function(subval) {
      str += 'sub: ' + subval + '\n';
    });
  });
  return str;
};

/**
 * Checks if the setting is valid.
 * @return {Boolean} If the list setting is valid
 */
ListSettingComponent.prototype.validate = function() {
  if (!this.initHtml_()) {
    return true; // return true is acceptable since the value will not be
                 // changed to invalid value
  }
  if (this.isInherited_) {
    return true; // don't check the inherited value, since the inherited value
                 // will not be saved.
  }
  return this.html_.validate();
};

/**
 * Sets access right to the setting, since there are more than one reason to set
 * the access right, we must record the reason.
 * @param {Boolean} readonly  If the setting is readonly
 * @param {String} reason  The reason to set the access right
 */
ListSettingComponent.prototype.setAccess = function(readonly, reason) {
  this.initHtml_();
  this.access_.set(readonly, reason);
  this.html_.setAccess(this.access_);
};


/**
 * ListenerManager provides a mechanism to inform one component that another 
 * component's value has been changed.
 * @param {SettingComponent} comp  The owner component of this listener manager
 */
function ListenerManager(comp) {
  /**
   * @type {SettingComponent}
   */
  this.owner_ = comp;

  /**
   * @type {Object} It's a look-up dictionary. The key is the type for the 
   * listening reason (<ListenerManager.listenTypes>), while the value is 
   * the listening components ({Array.<SettingComponent>}).
   * when the owner component's value is changed, all the listening components
   * that regist to this listener manager will be informed.
   */
  this.listeners_ = {};
}

/**
 * The type of listening.
 * @enum {String}
 */
ListenerManager.listenTypes = {SPACECONVERT: 'spaceConvert',
                               ACCESSCONTROL: 'accessControl'};
/**
 * Regists listening component.
 * @param {SettingComponent} comp  The listening component
 * @param {ListenerManager.listenTypes} type  The listening type
 */
ListenerManager.prototype.regist = function(comp, type) {
  if (!this.listeners_[type])
    this.listeners_[type] = [];

  this.listeners_[type].push(comp);
};

/**
 * Gets listening components for the type
 * @param {ListenerManager.listenTypes} type  The listening type
 * @return {Array.<SettingComponent>?} The listening components
 */
ListenerManager.prototype.listeners = function(type) {
  return this.listeners_[type];
};

/**
 * Inform the listeners that the value of owner is changed.
 * Up to now, there are two places using the function:
 * 1. OnChange/onclick Event handler, in case that user edit the setting value.
 * 2. Update value from XML.
 *
 * Note: For checkbox, onclick will not trigger onchange in IE, while it will
 * in Firefox. 
 */
ListenerManager.prototype.inform = function() {
  var changedComp = this.owner_;
  for (var type in this.listeners_) {
    Util.array.apply(this.listeners_[type], function(comp) {
      comp.listeningCallback(changedComp, type);
    });
  }
};

//////////////////////////////////////////////////////////////////////////
/**
 * It provides a mechanism to control a component's access right.
 * Since there are more than one reason to affect the setting component's 
 * access right, such as inherit from global setting or the service is disabled.
 * So we have to seperate their effect and record all the status of these 
 * reasons. If any of them requires these setting to be readonly, it will be 
 * readonly.
 * 
 * We use a dictionary to record the status of all the reasons.
 * 
 * @constructor
 */
function AccessManager() {
  /**
   * @type {Object} It's a dictionary, which key is the name of the reason, and
   * the value is the status ({Boolean}) of the reason.
   */
  this.disableFlags_ = {};
}

/**
 * Sets the access right of the setting component, since there are more
 * than one reason to set the access right, we must record the reason.
 * @param {Boolean} readonly  If the setting is readonly
 * @param {String} reason  The reason to set the access right
 */
AccessManager.prototype.set = function(readonly, reason) {
  this.disableFlags_[reason] = readonly;
};

/**
 * Gets the access right of the setting component.
 * @return {Boolean} The access right
 */
AccessManager.prototype.readonly = function() {
  var disableCount = 0;
  for (var id in this.disableFlags_) {
    if (this.disableFlags_[id])
      disableCount++;
  }

  // set the attribute
  if (disableCount == 0) {
    return false;
  } else {
    return true;
  }
};

/**
 * Sets access right to the HTML element of the setting.
 * @param {AccessManager} access  The access manager of this setting
 * @param {HTMLELement} elem  The HTML element of the setting
 */
AccessManager.setAccessToElem = function(access, elem) {
  // set the attribute
  if (access.readonly()) {;
    elem.setAttribute('disabled', true);
    Util.CSS.addClass(elem, READONLY_CLASS);
  } else {
    elem.removeAttribute('disabled');
    Util.CSS.removeClass(elem, READONLY_CLASS);
  }
};

//////////////////////////////////////////////////////////////////////////
/**
 * @constructor
 * @param {String|RegExp|null} pattern
 * @param {String?} opt_range
 * @param {Boolean?} opt_required
 */
function ValidateManager(pattern, opt_range, opt_required) {
  this.pattern_ = pattern;
  this.range_ = opt_range;
  this.required_ = opt_required;
  
  // set default pattern if no pattern given
  if (!this.pattern_) {
    if (this.required_ === true) {
      // '\\S' means any character that is not Unicode whitespace
      this.pattern_ = '\\S';
    } else {
      Util.console.error('invalid ValidateManager');
    }
  }
}

/**
 * Default validators.
 * @enum {ValidateManager}
 */
ValidateManager.validators = {
  DURATION: new ValidateManager('number', '[10,MAX)'),
  NUMBER: new ValidateManager('number', '(0,MAX)'),
  PASSWORD: new ValidateManager('password'),
  DATE: new ValidateManager('date'),
  XMLFILE: new ValidateManager('xmlfilename')
};

/**
 * Checks if the 'INPUT-text' element has valid value.
 * @param {Element} elem  The 'INPUT-text' element
 * @return {Boolean} If the 'INPUT-text' element has valid value
 */
ValidateManager.prototype.check = function(elem) {
  // do validation
  var isValid = this.validate_(elem.value);
  ValidateManager.setElementValidation_(elem, isValid);
  return isValid;
};

/**
 * Checks if the value is valid.
 * @param {String} value  The value to be checked
 * @return {Boolean} If the value is valid
 * @private
 */
ValidateManager.prototype.validate_ = function(value) {
  // If the value does not match the pattern, set the class to 'invalid'.
  var isValid;
  if (ValidateManager.matchPredefinedPattern_(this.pattern_, value) ||
      value.search(this.pattern_) != -1 ||
      this.required_ === false && value == '') {
    isValid = true;

    // if it is 'number' and define 'range', check the value for the range
    if (this.pattern_ == 'number' && this.range_ && value != '' &&
        !ValidateManager.isInRange_(this.range_, value)) {
      isValid = false;
    }
  } else {
    isValid = false;
  }

  return isValid;
};

/**
 * Checks if the pattern will be a predefined pattern name, and to see if the
 * value matches the predefined pattern.
 * @param {String|RegExp} pattern  The pattern name
 * @param {String} value  The value to be checked
 * @return {Boolean} True if the pattern is a predefined pattern name and the
 * value matches the predefined pattern.
 * @private
 */
ValidateManager.matchPredefinedPattern_ = function(pattern, value) {
  if (pattern == 'password') { // hardcode 'password' pattern
    return value.length >= 6 && value.length <= 50;
  }
  
  if (typeof pattern != 'string') { // can't be a predefined pattern name
    return false;
  }
  
  var predefinedPattern = ValidateManager.patterns_[pattern];
  if (!predefinedPattern) { // not found
    return false;
  }
  return value.search(predefinedPattern) != -1;
};

/**
 * Checks if the value is in the range.
 * @param {String} range  The range for the value
 * @param {String} val  The value to be checked
 * @return {Boolean} if the value is in range
 * @private
 */
ValidateManager.isInRange_ = function(range, val) {
  var matchs = range.match(/([\(\[])(\d*), *(\d*|MAX)([\)\]])/);
  if (!matchs) {
    return true;
  }
  
  var value = Number(val);
  if (isNaN(value)) {
    return false;
  }

  // have got range, check it!
  var lowerBoundFlag = matchs[1];
  var min = matchs[2];
  var max = matchs[3];
  var upperBoundFlag = matchs[4];
  if (min != '') {
    if (lowerBoundFlag == '(' && !(value > min)) {
      // Helper.debug('value '+value+', min '+min);
      return false;
    } else if (lowerBoundFlag == '[' && !(value >= min)) {
      return false;
    }
  }

  if (max != '') {
    if (max == 'MAX') {
      max = Number.MAX_VALUE;
    }
    if (upperBoundFlag == ')' && !(value < max)) {
      // Helper.debug('value '+value+', max '+max);
      return false;
    } else if (upperBoundFlag == ']' && !(value <= max)) {
      return false;
    }
  }
  return true;
};

/**
 * Sets the element's status (the background-color) for validation.
 * @param {Element} elem  The element to be set
 * @param {Boolean} valid  The validation result
 */
ValidateManager.setElementValidation_ = function(elem, valid) {
  if (valid)
    Util.CSS.removeClass(elem, INPUT_INVALID_CSS_CLASS);
  else
    Util.CSS.addClass(elem, INPUT_INVALID_CSS_CLASS);
};

/**
 * ToString function.
 * @return {String} the string representation of this object
 */
ValidateManager.prototype.toString = function() {
  return 'ValidateManager: {patter:' + this.pattern +
      '\trange:' + this.range +
      '\trequired:' + this.required + '}';
};

/**
 * Predefined patterns.
 * @enum {RegExp}
 * @private
 */
ValidateManager.patterns_ = {
  number: /^[\d]+$/,
  /* Any ASCII word character. Equivalent to [a-zA-Z0-9_].*/
  xmlfilename: /^[\w]+\.xml$/,
  host: /^[\w\.]*$/,
  logPath: /^.*$/,
  date: /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/,
  password: null, //pattern will hardcode into the function

  // url = http://(A+\.)*A+(/B*)?   A = [\w-]  B = [\w- ./?%&=] = [A ./?%&=]
  // urlmatch = /C*   C = [\w- ./?%&=\*] = [B\*]
  // urlfind = /(C*\[C*\]C*)+
  // urlreplace = /(C*\[B*\]C*)+
  //
  // urlInput = (A+\.)*A+(/B*)?
  // urlmatchInput = C*   C = [\w- ./?%&=\*] = [B\*]
  // urlfindInput = (C*\[C*\]C*)+
  // urlreplaceInput = B*
  //
  // the following can't be empty
  
  // http://...=
  urlInput: /^(?:[\w-]+\.)*[\w-]+(?:\/[\w- \.\/\?\%\&\=]*)?\=$/,
  
  // /..*..
  urlmatchInput: /^[\w- \.\/\?\%\&\=\*]+$/,
  
  urlfindInput: 
  /^(?:[\w- \.\/\?\%\&\=\*]*\[[\w- \.\/\?\%\&\=\*]*\][\w- \.\/\?\%\&\=\*]*)+$/,
  
  urlreplaceInput: /^[\w- \.\/\?\%\&\=]*$/
};