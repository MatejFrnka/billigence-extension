'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {

  const PARAMETER_ALL_VALUE = "All"
  const CONFIGURE_PATH = `/billigence-extension/config.html`;

  /**
   * stops the filter changed handler from being called multiple times
   * @type {boolean}
   */
  let resettingFilters = false; // todo maybe removing this could change something

  /**
   * Utility function that returns the saved configuration of extension
   * @returns {any}
   */
  function getFilterParamPairs() {
    const pairsString = tableau.extensions.settings.get("pairs")
    if (pairsString === undefined || pairsString === null) {
      console.error("Loading FilterParamPairs but plugin hasn't been configured yet")
      return []
    }
    return JSON.parse(pairsString);
  }

  /**
   * Initialization of extension
   */
  $(document).ready(function () {
    console.log("tableau extension initialization")
    tableau.extensions.initializeAsync({'configure': configure}).then(function () {
      console.log("tableau extension initialized")
      console.log("initializing listeners")
      initializeListeners();
      console.log("initialized listeners")
    }, function (err) {
      // Something went wrong in initialization.
      console.error('Error while Initializing: ' + err.toString());
    });
  });

  function configure() {
    const popupUrl = `${window.location.origin}${CONFIGURE_PATH}`;

    tableau.extensions.ui.displayDialogAsync(popupUrl, 10, {
      height: 500,
      width: 680
    }).catch((error) => {
      if (error.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
        console.error(error)
      }
    });
  }

  /**
   * Adds filter changed listeners to every worksheet in dashboard the extensions is running in
   */
  function initializeListeners() {
    // To get filter info, first get the dashboard.
    const dashboard = tableau.extensions.dashboardContent.dashboard; // todo possible to change this from dashboard to something else
    dashboard.worksheets.forEach(function (worksheet) {
      worksheet.addEventListener(tableau.TableauEventType.FilterChanged, filterChangedHandler);
    });
  }

  /**
   * This is a handling function that is called anytime a filter is changed in Tableau.
   * @param filterEvent event provided by tableau extension api
   * @returns {Promise<void>}
   */
  async function filterChangedHandler(filterEvent) {
    // return if filter resetting is already in progress
    if (resettingFilters) {
      console.log("Event ignore because filters are being reset - " + filterEvent.fieldName)
      return
    }
    try {
      // find parameter this filter is supposed to change
      console.log("finding pair for " + filterEvent.fieldName)
      let pairIndex = findFilterPairIndex(filterEvent.fieldName) // todo: maybe this finds a filter that it is not supposed to find and resets - probably not
      console.log(pairIndex)
      // if any parameter is found
      if (pairIndex !== null) {
        // get object Filter, pass it to updateParameter
        let filter = await filterEvent.getFilterAsync()
        await updateParameter(filter, pairIndex)
      }
    } catch (e) {
      console.error(e)
    }
  }

  /**
   * find filter pair with matching filterName to the parameter
   * @param filterName
   * @returns {number|null} index of pair to change
   */
  function findFilterPairIndex(filterName) {
    const filterParamPairs = getFilterParamPairs();
    for (let i = 0; i < filterParamPairs.length; i++) {
      if (filterParamPairs[i].filter === filterName) {
        return i;
      }
    }
    return null;
  }


  /**
   * Updates parameter with given name to value in filter.
   * @param filter: object Filter: https://tableau.github.io/extensions-api/docs/interfaces/filter.html
   * @param pairIndex int index of the parameter to be updated
   * @returns {Promise<void>}
   */
  async function updateParameter(filter, pairIndex) {
    console.log("param " + getFilterParamPairs()[pairIndex].param + ", filter " + "param " + getFilterParamPairs()[pairIndex].filter + " is being updated")
    // To get filter info, first get the dashboard.
    const dashboard = tableau.extensions.dashboardContent.dashboard; // todo - is it right to deal with dashboards here?
    const parameterName = getFilterParamPairs()[pairIndex].param
    let param = await dashboard.findParameterAsync(parameterName)
    console.log(param)
    // skip if parameter is null
    if (!(param === null || param === undefined)) {
      if (filter.isAllSelected !== true && filter.appliedValues.length !== 0) {
        console.log("changing param value to " + filter.appliedValues[0].value)
        param.changeValueAsync(filter.appliedValues[0].value)
      } else if (filter.isAllSelected === true) {
        // if filter is set to select everything, set parameter to all
        console.log("changing param value to ALL")
        param.changeValueAsync(PARAMETER_ALL_VALUE)
      } else {
        console.error("Unkown value being set")
      }
      await resetFilters(pairIndex + 1)
    }
  }

  // Accepts
  // * int that states index to start resetting filters from in filterParamPairs array
  /**
   * Resets all filters and parameters from `getFilterParamPairs();` starting at `resetFrom` until the end
   * @param resetFrom index to start resetting filters from in filterParamPairs array
   * @returns {Promise<void>}
   */
  async function resetFilters(resetFrom) {
    console.log("resetting filters and parameters from index " + resetFrom)
    resettingFilters = true;
    const filterParamPairs = getFilterParamPairs();
    try {
      const parameterPromises = [];
      // To get filter info, first get the dashboard.
      const dashboard = tableau.extensions.dashboardContent.dashboard; // todo maybe not dashboard

      for (let i = resetFrom; i < filterParamPairs.length; i++) {
        parameterPromises.push(dashboard.findParameterAsync(filterParamPairs[i].param))
      }

      let returnedParams = await Promise.all(parameterPromises);
      let filterClearPromises = []
      for (let i = 0; i < returnedParams.length; i++) {
        console.log("reseting parameter " + returnedParams[i].name + " to ALL value:");
        console.log(returnedParams[i]);
        // Reset parameter
        returnedParams[i].changeValueAsync(PARAMETER_ALL_VALUE)
          .catch(_ => console.error(`Parameter ${returnedParams[i].name}, (id: ${returnedParams[i].id}) cannot be reset to value ${PARAMETER_ALL_VALUE}`))

        // Reset filters in every worksheet
        let filterName = filterParamPairs[i + resetFrom].filter
        // todo this might be causing the issue - it would be better to know which worksheet the filter is in and only search that one.
        for (let j = 0; j < dashboard.worksheets.length; j++) {
          console.log("clearing filter " + filterName)
          let promise = dashboard.worksheets[j].clearFilterAsync(filterName)
            .then((e) => {
              console.log(`filter ${e} cleared`)
            })
            .catch(_ => {
              console.log("filter " + filterName + " from worksheet " + dashboard.worksheets[j].name + " not found (it shouldn't be an issue)")
              // don't do anything - errors will be thrown for every worksheet that doesn't have the filter
              // this may reset filters on other worksheets than the intended ones. Should this be applied to only one worksheet or to all?
              // it would be better to do it for one specific worksheet to improve performance for bigger projects
            });

          filterClearPromises.push(promise)
        }
      }
      await Promise.all(filterClearPromises);
    } catch (e) {
      console.error(e)
    } finally {
      console.log("filters no longer being reset")
      resettingFilters = false;
    }
    console.log("filter reset end")
  }
})();
