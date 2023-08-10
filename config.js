'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {

  const itemsContainer = document.getElementById('itemsContainer');
  const addButton = document.getElementById('addButton');
  const saveButton = document.getElementById('saveButton');

  let parameters = [];
  let filters = [];
  let itemCounter = 1;
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
    addButton.addEventListener('click', (_) => addNewItem());
    saveButton.addEventListener('click', saveItems);
  }

  function showExistingPairs() {
    const pairs = getFilterParamPairs()
    for (const pair of pairs) {
      addNewItem(pair.filter, pair.param)
    }
  }

  function closeDialog(savedData) {
    let pairs = []

    for (const val of savedData) {
      pairs.push({"filter": val[0], "param": val[1]})
    }

    tableau.extensions.settings.set("pairs", JSON.stringify(pairs))

    tableau.extensions.settings.saveAsync().then((_) => {
      tableau.extensions.ui.closeDialog();
    });
  }

  function getFilterParamPairs() {
    const pairsString = tableau.extensions.settings.get("pairs")
    return JSON.parse(pairsString);
  }


  // === UI CONTROLS ==

  function getParameters() {
    return parameters.map(filter => filter.name);
  }

  function getFilters() {
    return filters.map(filter => filter.fieldName);
  }

  function createMoveButton(text, clickHandler) {
    const button = document.createElement('button');
    button.innerHTML = text;
    button.addEventListener('click', clickHandler);
    return button;
  }

  function updateItemNumbers() {
    const items = Array.from(itemsContainer.children);
    items.forEach((item, index) => {
      const itemNumber = item.querySelector('.item-number');
      itemNumber.textContent = `${index + 1}:`;
    });
  }

  function addNewItem(filter = null, param = null) {
    const values = getParameters();
    const keys = getFilters();

    const itemDiv = document.createElement('div');
    itemDiv.classList.add('item');

    const itemNumber = document.createElement('span');
    itemNumber.textContent = `${itemCounter}:`;
    itemNumber.classList.add('item-number');
    itemCounter++;

    const selectBoxFilter = createSelectBox("Filter: ", keys, filter);
    const selectBoxParam = createSelectBox("Parameter: ", values, param);

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      itemCounter--;
      itemsContainer.removeChild(itemDiv);
      updateItemNumbers();
    });

    const moveUpButton = createMoveButton('&#8593;', () => {
      const currentIndex = Array.from(itemsContainer.children).indexOf(itemDiv);
      if (currentIndex > 0) {
        itemsContainer.insertBefore(itemDiv, itemsContainer.children[currentIndex - 1]);
        updateItemNumbers();
      }
    });

    const moveDownButton = createMoveButton('&#8595;', () => {
      const currentIndex = Array.from(itemsContainer.children).indexOf(itemDiv);
      if (currentIndex < itemsContainer.children.length - 1) {
        itemsContainer.insertBefore(itemDiv, itemsContainer.children[currentIndex + 2]);
        updateItemNumbers();
      }
    });

    itemDiv.appendChild(itemNumber);
    itemDiv.appendChild(selectBoxFilter);
    itemDiv.appendChild(selectBoxParam);
    itemDiv.appendChild(moveUpButton);
    itemDiv.appendChild(moveDownButton);
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

