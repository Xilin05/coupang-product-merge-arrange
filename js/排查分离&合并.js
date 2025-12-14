// 1. 以 商品注册id 为维度，判断其子属性 显示商品id 是否存在多个不同
//   a. 同一个链接但是被拆分成多条链接，需要做合并
//   b. 与其他商品合并，需要做拆分
// 2. 以 显示商品id 为维度，判断其父属性 商品注册id 是否存在多个
//   a. 只有一种情况：被合并，需要做拆分

import { productList } from "./产品信息数组数据-20250909"

// 优先动作：拆分
// 逻辑：取 显示商品id 作为key，循环产品列表，以 商品注册id 作为value(数组形式)，重复的值只存入一次，最后判断value长度是否大于2
// 实现：

const checkObj = {}
productList.forEach(product => {
  if (product['商品id'] in checkObj) {
    if(checkObj[product['商品id']].indexOf(product["注册商品ID"]) !== -1) checkObj[product['商品id']].push(product["注册商品ID"])
  } else {
    checkObj[product['商品id']] = [product["注册商品ID"]]
  }
})

console.log(checkObj);

