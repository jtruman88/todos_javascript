$(function() {
  function TodoList() {
    this.todos = [];
    this.templates = {};
    this.currentSelection = {};
  };
  
  TodoList.prototype = {
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
    
    fetchTodos: function() {
      const populateTodos = function(json) {
        this.todos = json;
        this.renderPage();
        this.updateSelection($('#all_header'));
        this.updateMain();
      }.bind(this);
      
      $.ajax({
        url: '/api/todos',
        success: populateTodos
      });
    },
    
    updateSelection: function($element) {
      if ($element.length == 0) {
        this.currentSelection.count = 0;
        return;  
      }
      
      this.removeAllActiveClass();
      $element.addClass('active');
      this.currentSelection.$element = $element;
      this.currentSelection.title = $element.attr('data-title');
      this.currentSelection.count = $element.attr('data-total');
    },
    
    removeAllActiveClass: function() {
      $('.active').removeClass('active');
    },
    
    getSelectedTodos: function() {
      let $element = this.currentSelection.$element;
      let title = this.currentSelection.title || 'All Todos';
      let todos;
      
      if (title === 'All Todos') {
        return this.sortByCompleted(this.addDueDate(this.todos));
      } else if (title === 'Completed') {
        return this.addDueDate(this.getCompletedTodos());
      } else if ($element.attr('id')) {
        todos = this.getCompletedTodos(this.getTodosByDate());
        return this.addDueDate(todos[title]);
      }  else {
        todos = this.getTodosByDate();
        return this.sortByCompleted(this.addDueDate(todos[title]));
      }
    },
    
    addDueDate: function(todoList) {
      let todos = (todoList || []).slice();
      todos.forEach(todo => todo.dueDate = this.getTodoDate(todo));
      return todos;
    },
    
    sortByCompleted: function(todos) {
      let complete = todos.filter(todo => todo.completed);
      let incomplete = todos.filter(todo => !todo.completed);
      return incomplete.concat(complete);
    },
    
    getCompletedTodos: function(todos) {
      let completed;
      if (todos) {
        completed = {};
        for (let date in todos) {
          let todoList = todos[date];
          let complete = todoList.filter(todo => todo.completed);
          if (complete.length > 0) {
            completed[date] = complete
          }
        }
        
        return completed;
      } else {
        return this.todos.filter(todo => todo.completed);
      }
    },
    
    getTodosByDate: function() {
      let todosByDate = {};
      this.todos.forEach(todo => {
        let date = this.getTodoDate(todo);
        if (todosByDate[date] ) {
          todosByDate[date].push(todo);
        } else {
          todosByDate[date] = [todo];
        }
      });
      
      return this.sortTodos(todosByDate);
    },
    
    sortTodos: function(todos) {
      let sorted = {};
      let keys = Object.keys(todos);
      let sortedKeys = this.sortKeysByYear(keys);
      
      sortedKeys.forEach(key => {
        sorted[key] = todos[key];
      });
      
      return sorted;
    },
    
    sortKeysByYear: function(keys) {
      return keys.sort((a, b) => {
        if (a === 'No Due Date') {
          return -1;
        } else if (b === 'No Due Date') {
          return 1;
        } else {
          let difference = Number(a.slice(3)) - Number(b.slice(3));
          if (difference === 0) {
            return this.sortByMonth(a, b);
          }
          
          return difference;
        }
      });
    },
    
    sortByMonth: function(first, second) {
      return Number(first.slice(0, 2)) - Number(second.slice(0, 2));
    },
    
    getTodoDate: function(todo) {
      if (!todo.month || !todo.year) {
        return 'No Due Date';
      } else {
        return todo.month + '/' + todo.year.slice(2);
      }
    },
    
    renderPage: function() {
      $(document.body).html(this.templates.main_template(this.getTemplateData()));
    },
    
    getTemplateData: function() {
      let templateData = {};
      templateData.selected = this.getSelectedTodos();
      templateData.todos = this.todos;
      templateData.done = this.getCompletedTodos();
      templateData.todosByDate = this.getTodosByDate();
      templateData.doneTodosByDate = this.getCompletedTodos(this.getTodosByDate());
      templateData.currentSelection = this.currentSelection;
      
      return templateData;
    },
    
    changeCurrentSelection: function(e) {
      if (e.currentTarget.tagName === 'DL') {
        this.updateSelection($(e.currentTarget).closest('dl'));
      } else {
        this.updateSelection($(e.currentTarget).find('header'));
      }
      
      this.updateMain();
    },
    
    updateMain: function() {
      let templateData = this.getTemplateData();
      $('#items header').html(this.templates.title_template(templateData));
      $('#items tbody').html(this.templates.list_template(templateData));
    },
    
    updateSidebar: function(select) {
      let selector = this.getSelector(select);
      let templateData = this.getTemplateData();
      $('#all_todos').html(this.templates.all_todos_template(templateData));
      $('#all_lists').html(this.templates.all_list_template(templateData));
      $('#completed_todos').html(this.templates.completed_todos_template(templateData));
      $('#completed_lists').html(this.templates.completed_list_template(templateData));
      this.updateSelection($(selector));
    },
    
    getSelector: function(select) {
      if (select) {
        return '#all_header';
      }
      
      let parentId = this.currentSelection.$element.parent().attr('id');
      let dataTitle = this.currentSelection.$element.attr('data-title');
      return '#' + parentId + ' [data-title="' + dataTitle + '"]';
    },
    
    handleNewTodo: function(e) {
      e.preventDefault();
      
      this.updateForm('api/todos', 'post');
      this.displayModal();
    },
    
    updateForm: function(url, type) {
      let $form = $('form');
      $form.attr('action', url);
      $form.attr('method', type);
    },
    
    displayModal: function() {
      $('.modal').fadeIn();
      $('#modal_layer').on('click', this.hideModal.bind(this));
    },
    
    hideModal: function() {
      $('.modal').fadeOut(400, () => {
        this.clearForm();
      });
    },
    
    clearForm: function() {
      document.querySelector('form').reset();
    },
    
    handleFormSubmit: function(e) {
      e.preventDefault();
      let $form = $(e.target);
      
      if (this.isValidTodo($form)) {
        if ($form.attr('method') === 'post') {
          this.addNewTodo($form);
        } else {
          this.updateTodo($form);
        }
        
        this.hideModal();
      } else {
        alert('Todo title must be at least 3 characters long.');
      }
    },
    
    isValidTodo: function($form) {
      let title = $form.find('#title').val();
      return title.trim().length >= 3;
    },
    
    addNewTodo: function($form) {
      const updateWithNewTodo = function(newTodo) {
        this.todos.push(newTodo);
        this.updateSidebar('#all_header');
        this.updateMain();
      }.bind(this);
      
      $.ajax({
        url: $form.attr('action'),
        type: $form.attr('method'),
        data: $form.serialize(),
        success: updateWithNewTodo
      });
    },
    
    handleUpdateTodo: function(e) {
      e.preventDefault();
      let id = Number($(e.target).closest('tr').attr('data-id'));
      let todo = this.getTodoById(id);
      
      this.updateInputs(todo);
      this.updateForm('/api/todos/' + id, 'put');
      this.displayModal();
    },
    
    updateInputs: function(todo) {
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
    },
    
    getTodoById: function(id) {
      return this.todos.find(todo => todo.id === id);
    },
    
    updateTodo: function($form) {
      const updateTodo = this.replaceUpdatedTodo.bind(this);
      
      $.ajax({
        url: $form.attr('action'),
        type: $form.attr('method'),
        data: $form.serialize(),
        success: updateTodo
      });
    },
    
    replaceTodo: function(updatedTodo) {
      this.todos.forEach((todo, ind) => {
        if (todo.id === updatedTodo.id) {
          this.todos[ind] = updatedTodo;
          return false;
        }
      });
    },
    
    handleClickComplete: function(e) {
      if (e.target.tagName === 'LABEL') {
        return;
      }
      
      let $element = $(e.target).closest('td');
      let id = $element.parent().attr('data-id');
      this.toggleChecked($element);
      this.toggleTodoCompleted(id);
    },
    
    toggleTodoCompleted: function(id) {
      const updateTodoCompleted = this.replaceUpdatedTodo.bind(this);
      
      $.ajax({
        url: '/api/todos/' + id + '/toggle_completed',
        type: 'post',
        success: updateTodoCompleted
      });
    },
    
    replaceUpdatedTodo: function(updatedTodo) {
      this.replaceTodo(updatedTodo);
      this.updateSidebar();
      this.updateMain();
    },
    
    toggleChecked: function($element) {
      let $input = $element.find('input');
      if ($input.prop('checked')) {
        $input.prop('checked', false);
      } else {
        $input.prop('checked', true);
      }
    },
    
    handleDeleteTodo: function(e) {
      let id = $(e.target).closest('tr').attr('data-id');
      this.deleteTodo(id);
    },
    
    deleteTodo: function(id) {
      const deleteTodo = function() {
        this.removeFromTodos(Number(id));
        this.updateSidebar();
        this.updateMain();
      }.bind(this);
      
      $.ajax({
        url: '/api/todos/' + id,
        type: 'delete',
        success: deleteTodo
      });
    },
    
    removeFromTodos: function(id) {
      this.todos.forEach((todo, ind) => {
        if (todo.id === id) {
          this.todos.splice(ind, 1);
          return false;
        }
      });
    },
    
    handleMarkComplete: function(e) {
      e.preventDefault();
      let $form = $(e.target).closest('form');
      let type = $form.attr('method');
      let id = $form.attr('action').split('/')[3];
      
      if (type === 'post') {
        alert('You cannot complete a todo that has not been created.');
      } else {
        this.hideModal();
        this.markTodoComplete(id);
      }
    },
    
    markTodoComplete: function(id) {
      let data = 'completed=' + id;
      const markTodoComplete = this.replaceUpdatedTodo.bind(this);
      
      $.ajax({
        url: '/api/todos/' + id,
        type: 'put',
        data: data,
        success: markTodoComplete
      });
    },
    
    bindEvents: function() {
      let $document = $(document);
      $document.on('click', 'article dl', this.changeCurrentSelection.bind(this));
      $document.on('click', 'section div', this.changeCurrentSelection.bind(this));
      $document.on('click', 'main > label', this.handleNewTodo.bind(this));
      $document.on('submit', 'form', this.handleFormSubmit.bind(this));
      $document.on('click', 'td label', this.handleUpdateTodo.bind(this));
      $document.on('click', 'td.list_item', this.handleClickComplete.bind(this));
      $document.on('click', 'td.delete', this.handleDeleteTodo.bind(this));
      $document.on('click', 'button', this.handleMarkComplete.bind(this));
    },
    
    init: function() {
      this.registerPartials();
      this.cacheTemplates();
      this.fetchTodos();
      this.bindEvents();
    },
    
    constuctor: TodoList,
  };
  
  const todos = new TodoList();
  todos.init();
});