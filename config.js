'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {

  const itemsContainer = document.getElementById('itemsContainer');
  const addButton = document.getElementById('addButton');
  const saveButton = document.getElementById('saveButton');

  let parameters = [];
  let filters = [];

  $(document).ready(function () {
    tableau.extensions.initializeDialogAsync().then(async function (_) {
      await loadFiltersAndParams()
      setupUI();
      showExistingPairs()

    });
  });

  async function loadFiltersAndParams() {
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    let parameterPromises = []
    let filterPromises = []
    parameterPromises.push(dashboard.getParametersAsync())
    filterPromises.push(dashboard.getFiltersAsync())
    dashboard.worksheets.forEach(function (worksheet) {
      parameterPromises.push(worksheet.getParametersAsync())
      filterPromises.push(worksheet.getFiltersAsync())
    });
    parameters = await collectPromises(parameterPromises, (p) => p.id)
    filters = await collectPromises(filterPromises, (p) => p.fieldId)
  }

  async function collectPromises(promiseArray, identifier) {
    let res = []
    let returnedParams = await Promise.all(promiseArray);
    for (let arr of returnedParams) {
      for (let param of arr) {
        if (!res.some(p => identifier(p) === identifier(param))) {
          res.push(param)
        }
      }
    }
    return res
  }

  function setupUI() {
    addButton.addEventListener('click', addNewItem);
    saveButton.addEventListener('click', saveItems);
  }

  function showExistingPairs() {
    const settings = tableau.extensions.settings.getAll()
    for (const key in settings) {
      addNewItem(key, settings[key])
    }
  }

  function closeDialog(savedData) {
    const settings = tableau.extensions.settings.getAll()
    for (const key in settings) {
      tableau.extensions.settings.erase(key);
    }
    for (const val of savedData) {
      tableau.extensions.settings.set(val[0], val[1]);
    }

    tableau.extensions.settings.saveAsync().then((newSavedSettings) => {
      console.log(newSavedSettings)
      tableau.extensions.ui.closeDialog();
    });


  }

  // === UI CONTROLS ==

  function getParameters() {
    return parameters.map(filter => filter.name);
  }

  function getFilters() {
    return filters.map(filter => filter.fieldName);
  }

  function addNewItem(filter = null, param = null) {
    const values = getParameters();
    const keys = getFilters();

    const itemDiv = document.createElement('div');
    itemDiv.classList.add('item');

    const selectBoxFilter = createSelectBox("Filter: ", keys, filter);
    const selectBoxParam = createSelectBox("Parameter: ", values, param);

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      itemsContainer.removeChild(itemDiv);
    });

    itemDiv.appendChild(selectBoxFilter);
    itemDiv.appendChild(selectBoxParam);
    itemDiv.appendChild(removeButton);

    itemsContainer.appendChild(itemDiv);
  }

  function createSelectBox(labelText, values, currentValue = null) {
    const container = document.createElement('div');

    const label = document.createElement('label');
    label.textContent = labelText;

    const select = document.createElement('select');

    values.forEach((val, index) => {
      const option = document.createElement('option');
      option.value = val;
      option.textContent = val;
      select.appendChild(option);
    });

    if (currentValue !== null) {
      select.value = currentValue
    }

    container.appendChild(label);
    container.appendChild(select);

    return container;
  }

  function saveItems() {
    const items = Array.from(document.querySelectorAll('.item'));
    let filters = []
    const savedData = items.map(item => {
      const selectBoxes = item.querySelectorAll('select');
      filters.push(selectBoxes[0].value)
      return [selectBoxes[0].value, selectBoxes[1].value];
    });

    if (filters.length !== new Set(filters).size) {
      alert("Filter must not be used more than once");
    } else {
      closeDialog(savedData);
    }
  }

})();

