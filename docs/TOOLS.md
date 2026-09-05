# MCP tool reference / 接口目录

Generated from the shared catalog. Do not edit this table by hand.

unified: 40 tools including get_capabilities; devtools: 37 tools including get_capabilities; vscode-compat: 26 tools including get_capabilities

Tools are filtered by adapter support and permission policy. Profiles describe contracts, not a promise that every adapter implements every tool.

| Tool | Capability | Risk | Profiles |
| --- | --- | --- | --- |
| get_capabilities | discovery | read | all |
| get_menu_configuration | menus.read | read | unified, devtools |
| plan_menu_item | menus.read | read | unified, devtools |
| apply_menu_item | menus.write | write | unified, devtools |
| validate_ssl | ssl.validate | read | unified, devtools |
| get_editor_diagnostics | diagnostics.read | read | unified, devtools |
| get_devtools_output | devtools.logs.read | read | unified, devtools |
| open_form_preview | forms.preview.open | execute | unified, devtools |
| refresh_form_preview | forms.preview.control | execute | unified, devtools |
| set_preview_viewport | forms.preview.control | read | unified, devtools |
| capture_form_screenshot | forms.preview.capture | read | unified, devtools |
| inspect_form_element | forms.preview.inspect | read | unified, devtools |
| get_preview_console_errors | forms.preview.logs | read | unified, devtools |
| get_preview_load_errors | forms.preview.logs | read | unified, devtools |
| browse_tree | items.browse | read | unified, devtools, vscode-compat |
| search_by_name | items.search | read | unified, devtools, vscode-compat |
| global_code_search | code.search | read | unified, devtools, vscode-compat |
| list_languages | languages.list | read | unified, devtools, vscode-compat |
| get_item_code | code.read | read | unified, devtools, vscode-compat |
| get_form_resources | forms.resources.read | read | unified, devtools, vscode-compat |
| read_log | logs.read | read | unified, devtools, vscode-compat |
| get_table_definition | tables.read | read | unified, devtools, vscode-compat |
| checkout_item | checkout.write | write | unified, devtools, vscode-compat |
| save_item | code.write | write | unified, devtools, vscode-compat |
| save_form_resources | forms.resources.write | write | unified, devtools, vscode-compat |
| set_form_resource | forms.resources.write | write | unified, devtools, vscode-compat |
| checkin_item | checkout.checkin | write | unified, devtools, vscode-compat |
| undo_checkout | checkout.undo | destructive | unified, devtools, vscode-compat |
| execute_server_script | scripts.execute | execute | unified, devtools, vscode-compat |
| execute_data_source | datasource.execute | execute | unified, devtools, vscode-compat |
| list_checked_out_items | checkout.list | read | unified, devtools |
| query_checkin_history | scm.history | read | unified, devtools |
| refresh_checkout_tree | checkout.refresh | write | unified, vscode-compat |
| vscode_save_local_item | code.write.local | write | vscode-compat |
| create_item | items.create | write | unified, devtools, vscode-compat |
| checkout_table | tables.checkout | write | unified, devtools, vscode-compat |
| checkin_table | tables.checkin | write | unified, devtools, vscode-compat |
| create_table | tables.create | write | unified, devtools, vscode-compat |
| edit_table | tables.write | write | unified, devtools, vscode-compat |
| run_integration_tests | tests.run | execute | unified, vscode-compat |
| transfer_item_to_server | transfer.run | write | unified, vscode-compat |

All DevTools tools are registered by createStarlimsMcpServer from this catalog. DevTools supplies an adapter and must not append tools or modify their schemas.
