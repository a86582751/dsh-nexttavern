// Generated from runtime/alpha3/src/core/tavern-mvu-196/variable-def.ts; edit the TypeScript source.
export function assertVWD(_flag, _v) { }
export function isValueWithDescription(value) {
    return Array.isArray(value) && value.length === 2 && typeof value[1] === 'string';
}
export function isValueWithDescriptionStatData(value) {
    return Array.isArray(value) && value.length === 2 && typeof value[1] === 'string';
}
// 类型守卫函数
export function isArraySchema(value) {
    return value.type === 'array';
}
export function isObjectSchema(value) {
    return value.type === 'object';
}
export function isPrimitiveSchema(value) {
    return (value.type === 'string' ||
        value.type === 'number' ||
        value.type === 'boolean' ||
        value.type === 'any');
}
export const exported_events = {
    //对外接口，外部可以通过 event 的形式，对 mvu 的分析操作进行调用。
    INVOKE_MVU_PROCESS: 'mag_invoke_mvu',
    //调用更新变量函数的事件。
    UPDATE_VARIABLE: 'mag_update_variable',
};
export const variable_events = {
    /** 新开聊天对变量初始化时触发的事件  */
    VARIABLE_INITIALIZED: 'mag_variable_initialized',
    /** 某轮变量更新开始时触发的事件 */
    VARIABLE_UPDATE_STARTED: 'mag_variable_update_started',
    /**
     * 某轮变量更新过程中, 对文本成功解析了所有更新命令时触发的事件
     *
     * @example
     * // 修复 gemini 在中文间加入的 '-'', 如将 '角色.络-络' 修复为 '角色.络络'
     * eventOn(Mvu.events.COMMAND_PARSED, commands => {
     *   commands.forEach(command => {
     *     command.args[0] = command.args[0].replace(/-/g, '');
     *   });
     * });
     *
     * @example
     * // 修复繁体字, 如将 '絡絡' 修复为 '络络'
     * eventOn(Mvu.events.COMMAND_PARSED, commands => {
     *   commands.forEach(command => {
     *     command.args[0] = command.args[0].replaceAll('絡絡', '络络');
     *   });
     * });
     *
     * @example
     * // 添加新的更新命令
     * eventOn(Mvu.events.COMMAND_PARSED, commands => {
     *   commands.push({
     *     type: 'set',
     *     full_match: `_.set('络络.好感度', 5)`,
     *     args: ['络络.好感度', 5],
     *     reason: '脚本强行更新',
     *   });
     * });
     */
    COMMAND_PARSED: 'mag_command_parsed',
    /**
     * 某轮变量更新结束时触发的事件
     *
     * @example
     * // 保持好感度不低于 0
     * eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, variables => {
     *   if (_.get(variables, 'stat_data.角色.络络.好感度') < 0) {
     *     _.set(variables, 'stat_data.角色.络络.好感度', 0);
     *   }
     * })
     *
     * @example
     * // 保持好感度增幅不超过 3
     * eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (variables, variables_before_update) => {
     *   const old_value = _.get(variables_before_update, 'stat_data.角色.络络.好感度');
     *   const new_value = _.get(variables, 'stat_data.角色.络络.好感度');
     *
     *   // 新的好感度必须在 旧好感度-3 和 旧好感度+3 之间
     *   _.set(variables, 'stat_data.角色.络络.好感度', _.clamp(new_value, old_value - 3, old_value + 3));
     * });
     */
    VARIABLE_UPDATE_ENDED: 'mag_variable_update_ended',
    /** 即将用更新后的变量更新楼层时触发的事件  */
    BEFORE_MESSAGE_UPDATE: 'mag_before_message_update',
    /** @deprecated */
    SINGLE_VARIABLE_UPDATED: 'mag_variable_updated',
};
export const UPDATE_REGEX = /\[mvu_update\]/i;
export const PLOT_REGEX = /\[mvu_plot\]/i;
