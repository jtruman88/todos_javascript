$(function() {
  const app = (function() {
    return {
      init: function() {
        page.registerPartials();
        page.cacheTemplates();
        xhr.fetchTodos();
        page.bindEvents();
      },
    };
  })();
  
  const page = (function() {
    function getTemplateData() {
      let self = this;
      
      return {
        selected: todos.getSelectedTodos(),
        todos: todos.list,
        done: todos.getCompletedTodos(),
        todosByDate: todos.getTodosByDate(),
        doneTodosByDate: todos.getCompletedTodos(todos.getTodosByDate()),
        currentSelection: self.currentSelection,
      };
    }
    
    function handleNewTodo(e) {
      e.preventDefault();
      
      updateForm('api/todos', 'post');
      displayModal();
    }
    
    function changeCurrentSelection(e) {
      if (e.currentTarget.tagName === 'DL') {
        this.updateSelection($(e.currentTarget).closest('dl'));
      } else {
        this.updateSelection($(e.currentTarget).find('header'));
      }

      this.updateMain();
    }
    
    function handleFormSubmit(e) {
      e.preventDefault();
      let $form = $(e.target);
      
      if (isValidTodo($form)) {
        if ($form.attr('method') === 'post') {
          xhr.addNewTodo($form);
        } else {
          xhr.updateTodo($form);
        }
        
        hideModal();
      } else {
        alert('Todo title must be at least 3 characters long.');
      }
    }
    
    function isValidTodo($form) {
      let title = $form.find('#title').val();
      return title.trim().length >= 3;
    }
    
    function getSelector(select) {
      if (select) {
        return '#all_header';
      }
      
      let parentId = this.currentSelection.$element.parent().attr('id');
      let dataTitle = this.currentSelection.$element.attr('data-title');
      return '#' + parentId + ' [data-title="' + dataTitle + '"]';
    }
    
    function handleClickComplete(e) {
      if (e.target.tagName === 'LABEL') {
        return;
      }
      
      let $element = $(e.target).closest('td');
      let id = $element.parent().attr('data-id');
      toggleChecked($element);
      xhr.toggleTodoCompleted(id);
    }
    
    function toggleChecked($element) {
      let $input = $element.find('input');
      if ($input.prop('checked')) {
        $input.prop('checked', false);
      } else {
        $input.prop('checked', true);
      }
    }
    
    function handleUpdateTodo(e) {
      e.preventDefault();
      let id = Number($(e.target).closest('tr').attr('data-id'));
      let todo = todos.getTodoById(id);
      
      updateInputs(todo);
      updateForm('/api/todos/' + id, 'put');
      displayModal();
    }
    
    function updateInputs(todo) {
      $('#title').val(todo.title);
      
      if (todo.day) {
        $('#due_day').val(todo.day);
      }
      
      if (todo.month) {
        $('#due_month').val(todo.month);
      }
      
      if (todo.year) {
        $('#due_year').val(todo.year);
      }
      
      if (todo.description) {
        $('textarea').val(todo.description);
      }
    }
    
    function updateForm(url, type) {
      let $form = $('form');
      $form.attr('action', url);
      $form.attr('method', type);
    }
    
    function displayModal() {
      $('.modal').fadeIn();
      $('#modal_layer').on('click', hideModal);
    }
    
    function hideModal() {
      $('.modal').fadeOut(400, clearForm);
    }
    
    function clearForm() {
      document.querySelector('form').reset();
    }
    
    function handleDeleteTodo(e) {
      let id = $(e.target).closest('tr').attr('data-id');
      xhr.deleteTodo(id);
    }
    
    function handleMarkComplete(e) {
      e.preventDefault();
      let $form = $(e.target).closest('form');
      let type = $form.attr('method');
      let id = $form.attr('action').split('/')[3];
      
      if (type === 'post') {
        alert('You cannot complete a todo that has not been created.');
      } else {
        hideModal();
        xhr.markTodoComplete(id);
      }
    }
    
    function removeAllActiveClass() {
      $('.active').removeClass('active');
    }
        
    return {
      templates: {},
      currentSelection: {},
      
      registerPartials: function() {
        let $partials = $('[data-type="partial"]');
        $partials.each((i, partial) => {
          let $partial = $(partial);
          Handlebars.registerPartial($partial.attr('id'), $partial.html());
        });
      },
    
      cacheTemplates: function() {
        let $templates = $('[type="text/x-handlebars"]');
        $templates.each((i, template) => {
          let $template = $(template).remove();
          this.templates[$template.attr('id')] = Handlebars.compile($template.html());
        });
      },
    
      render: function() {
        $(document.body).html(this.templates.main_template(getTemplateData.call(this)));
      },
    
      updateMain: function() {
        let templateData = getTemplateData.call(this);
        $('#items header').html(this.templates.title_template(templateData));
        $('#items tbody').html(this.templates.list_template(templateData));
      },
    
      updateSidebar: function(select) {
        let selector = getSelector.call(this, select);
        let templateData = getTemplateData.call(this);
        $('#all_todos').html(this.templates.all_todos_template(templateData));
        $('#all_lists').html(this.templates.all_list_template(templateData));
        $('#completed_todos').html(this.templates.completed_todos_template(templateData));
        $('#completed_lists').html(this.templates.completed_list_template(templateData));
        this.updateSelection($(selector));
      },
    
      updateSelection: function($element) {
        if ($element.length === 0) {
          this.currentSelection.count = 0;
          return;  
        }

        removeAllActiveClass();
        $element.addClass('active');
        this.currentSelection.$element = $element;
        this.currentSelection.title = $element.attr('data-title');
        this.currentSelection.count = $element.attr('data-total');
      },
    
      bindEvents: function() {
        let $document = $(document);
        $document.on('click', 'article dl', changeCurrentSelection.bind(this));
        $document.on('click', 'section div', changeCurrentSelection.bind(this));
        $document.on('click', 'main > label', handleNewTodo.bind(this));
        $document.on('submit', 'form', handleFormSubmit.bind(this));
        $document.on('click', 'td label', handleUpdateTodo);
        $document.on('click', 'td.list_item', handleClickComplete.bind(this));
        $document.on('click', 'td.delete', handleDeleteTodo);
        $document.on('click', 'button', handleMarkComplete);
      },
    };
  })();
  
  const todos = (function() {
    function addDueDate(todoList) {
      let todos = (todoList || []).slice();
      todos.forEach(todo => todo.dueDate = getTodoDate(todo));
      return todos;
    }
    
    function getTodoDate(todo) {
      if (!todo.month || !todo.year) {
        return 'No Due Date';
      } else {
        return todo.month + '/' + todo.year.slice(2);
      }
    }
    
    function sortTodos(todos) {
      let sorted = {};
      let keys = Object.keys(todos);
      let sortedKeys = sortKeysByYear(keys);
      
      sortedKeys.forEach(key => {
        sorted[key] = todos[key];
      });
      
      return sorted;
    }
    
    function sortKeysByYear(keys) {
      return keys.sort((a, b) => {
        if (a === 'No Due Date') {
          return -1;
        } else if (b === 'No Due Date') {
          return 1;
        } else {
          let difference = Number(a.slice(3)) - Number(b.slice(3));
          if (difference === 0) {
            return sortByMonth(a, b);
          }
          
          return difference;
        }
      });
    }
    
    function sortByMonth(first, second) {
      return Number(first.slice(0, 2)) - Number(second.slice(0, 2));
    }
    
    function sortByCompleted(todos) {
      let complete = todos.filter(todo => todo.completed);
      let incomplete = todos.filter(todo => !todo.completed);
      return incomplete.concat(complete);
    }
    
    function getCompletedTodosObject(todos) {
      let completed = {};
      
      for (let date in todos) {
        let todoList = todos[date];
        let complete = todoList.filter(todo => todo.completed);
        if (complete.length > 0) {
          completed[date] = complete
        }
      }
      
      return completed;
    }
    
    return {
      list: [],
    
      getSelectedTodos: function() {
        let $element = page.currentSelection.$element;
        let title = page.currentSelection.title || 'All Todos';
        let todos;

        if (title === 'All Todos') {
          return sortByCompleted(addDueDate(this.list));
        } else if (title === 'Completed') {
          return addDueDate(this.getCompletedTodos());
        } else if ($element.attr('id')) {
          todos = this.getCompletedTodos(this.getTodosByDate());
          return addDueDate(todos[title]);
        }  else {
          todos = this.getTodosByDate();
          return sortByCompleted(addDueDate(todos[title]));
        }
      },
    
      getCompletedTodos: function(todos) {
        let completed;
        if (todos) {
          completed = getCompletedTodosObject(todos);
          return completed;
        } else {
          return this.list.filter(todo => todo.completed);
        }
      },
    
      getTodosByDate: function() {
        let todosByDate = {};
        this.list.forEach(todo => {
          let date = getTodoDate(todo);
          if (todosByDate[date] ) {
            todosByDate[date].push(todo);
          } else {
            todosByDate[date] = [todo];
          }
        });

        return sortTodos(todosByDate);
      },
    
      replaceTodo: function(updatedTodo) {
        this.list.forEach((todo, ind) => {
          if (todo.id === updatedTodo.id) {
            this.list[ind] = updatedTodo;
            return false;
          }
        });
      },
    
      getTodoById: function(id) {
        return this.list.find(todo => todo.id === id);
      },
    
      removeFromTodos: function(id) {
        this.list.forEach((todo, ind) => {
          if (todo.id === id) {
            this.list.splice(ind, 1);
            return false;
          }
        });
      },
    };
  })();
  
  const xhr = (function() {
    function populateTodos(json) {
      todos.list = json;
      page.render();
      page.updateSelection($('#all_header'));
      page.updateMain();
    }
    
   function updateWithNewTodo(newTodo) {
      todos.list.push(newTodo);
      page.updateSidebar('#all_header');
      page.updateMain();
    }
    
    function replaceUpdatedTodo(updatedTodo) {
      todos.replaceTodo(updatedTodo);
      page.updateSidebar();
      page.updateMain();
    }
    
    function deleteTodo(id) {
      todos.removeFromTodos(Number(id));
      page.updateSidebar();
      page.updateMain();
    }
    
    return {
      fetchTodos: function() {
        $.ajax({
          url: '/api/todos',
          success: populateTodos
        });
      },
    
      addNewTodo: function($form) {
        $.ajax({
          url: $form.attr('action'),
          type: $form.attr('method'),
          data: $form.serialize(),
          success: updateWithNewTodo
        });
      },
    
      updateTodo: function($form) {
        $.ajax({
          url: $form.attr('action'),
          type: $form.attr('method'),
          data: $form.serialize(),
          success: replaceUpdatedTodo
        });
      },
    
      toggleTodoCompleted: function(id) {
        $.ajax({
          url: '/api/todos/' + id + '/toggle_completed',
          type: 'post',
          success: replaceUpdatedTodo
        });
      },
    
      deleteTodo: function(id) {
        $.ajax({
          url: '/api/todos/' + id,
          type: 'delete',
          success: deleteTodo.bind(null, id)
        });
      },
    
      markTodoComplete: function(id) {
        let data = 'completed=' + id;

        $.ajax({
          url: '/api/todos/' + id,
          type: 'put',
          data: data,
          success: replaceUpdatedTodo
        });
      },
    };
  })();
  
  app.init();
});