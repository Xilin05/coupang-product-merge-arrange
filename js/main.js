const { createApp, ref, reactive, onMounted } = Vue;

const APP = createApp({
  setup() {
    let products = ref(window.my_app_data?.productList || []);
    let mergeProducts = ref([]);

    function openCoupangLink(payload) {
      // console.log(
      //   `https://www.coupang.com/vp/products/${payload?.PID}?vendorItemId=${payload?.VID}`
      // );

      window.open(
        `https://www.coupang.com/vp/products/${payload?.PID}?vendorItemId=${payload?.VID}`,
        "_blank"
      );
    }

    /** 前期整理数据：筛选被合并曝光的产品 - 开始 */
    let checkMergeObj = ref({});
    let mergeInfoList = ref([]);
    let mergeInfoListBackUp = [];
    /** 
    循环遍历产品数组
    检查当前曝光id是否已经记录在案
    不在：则新增一个字段，key是当前产品信息对象的曝光id
    存在：
      检查当前曝光id的字段信息数组是否已经记录当前产品信息对象的注册商品ID：
        存在：跳过
        不存在：当前曝光id的字段信息数组插入当前产品信息对象的注册商品id
    */

    function formatMergeData() {
      window.my_app_data.productList?.forEach(product => {
        if (product["PID"] in checkMergeObj.value) {
          if (
            checkMergeObj.value[product["PID"]].ridList.indexOf(
              product["RID"]
            ) === -1
          ) {
            checkMergeObj.value[product["PID"]].ridList.push(product["RID"]);
            checkMergeObj.value[product["PID"]].skuList.push(product);
            checkMergeObj.value[product["PID"]][product["RID"]] = product;
          }
        } else {
          checkMergeObj.value[product["PID"]] = {};
          checkMergeObj.value[product["PID"]].skuList = [];
          checkMergeObj.value[product["PID"]].skuList.push(product);
          checkMergeObj.value[product["PID"]].ridList = [product["RID"]];
          checkMergeObj.value[product["PID"]][product["RID"]] = product;
        }
      });

      // console.log(Object.keys(checkMergeObj.value).length, checkMergeObj.value);

      let resObj = {};
      for (let key in checkMergeObj.value) {
        if (checkMergeObj.value[key].ridList.length > 1) {
          resObj = { ...checkMergeObj.value[key] };
          resObj["PID"] = key;

          mergeInfoList.value.push(resObj);
          resObj = {};
        }
      }

      console.log("筛选存在重复的曝光id", mergeInfoList.value);
    }

    formatMergeData();

    function sortSamePID(list, isInit = false) {
      let tempList = [];

      if (isInit) {
        list.forEach(item => {
          let filterRes = products.value.filter(
            product => product.PID === item.PID
          );
          tempList.push(...filterRes);
        });
      } else {
        let tempPidList = [];
        list.forEach(item => {
          if (!tempPidList.includes(item.PID)) tempPidList.push(item.PID);
        });

        tempPidList.forEach(pid => {
          let filterRes = list.filter(item => item.PID === pid);
          tempList.push(...filterRes);
        });
      }

      return tempList;
    }

    /** 整理被合并的产品数据并展示到表格 ---结束 */
    let pidObj = {};
    function formatListData(list, isInit = false) {
      list.forEach(element => {
        let count = list.filter(item => item.PID === element.PID).length;

        if (pidObj?.[element.PID]) {
          pidObj[element.PID] += 1;
        } else {
          pidObj[element.PID] = 1;
        }

        element.PIDIndex = pidObj?.[element.PID];
        element.samePIDCount = count;
      });

      isInit && (mergeInfoListBackUp = JSON.stringify(list));
      mergeProducts.value = JSON.parse(JSON.stringify(list));
      pidObj = {};

      return list;
    }

    formatListData(sortSamePID(mergeInfoList.value, true), true);
    /** 整理被合并的产品数据并展示到表格 ---结束 */

    /** 前期整理数据：筛选被合并曝光的产品 - 结束 */
    function PIDSpanMethod({ row, column, rowIndex, columnIndex }) {
      if (columnIndex === 0) {
        if (row.PIDIndex === 1) {
          return {
            rowspan: row.samePIDCount,
            colspan: 1,
          };
        } else {
          return {
            rowspan: 0,
            colspan: 0,
          };
        }
      }
    }

    // function handleCopy(index, row) {
    function handleCopy(
      value,
      { keepLineBreak = true, onSuccess = () => {}, onError = () => {} } = {}
    ) {
      console.log("keepLineBreak", keepLineBreak);

      try {
        // 创建元素（textarea 支持换行，input 只能单行）
        const el = keepLineBreak
          ? document.createElement("textarea")
          : document.createElement("input");

        value = mergeProducts.value.map(product => product.VID).join("\r\n");
        // 设置文本，去掉换行时替换为一个空格
        el.value = keepLineBreak ? value : value.replace(/\n/g, " ");

        // 防止页面滚动闪动
        el.style.position = "fixed";
        el.style.top = "-9999px";
        el.style.left = "-9999px";
        el.style.opacity = "0";

        document.body.appendChild(el);
        el.select();
        el.setSelectionRange(0, el.value.length); // 移动端兼容

        const success = document.execCommand("copy");

        document.body.removeChild(el);

        if (success) {
          onSuccess();
        } else {
          throw new Error("复制命令返回 false");
        }
      } catch (err) {
        console.error("复制失败:", err);
        onError(err);
      }

      // return mergeProducts.value.map((product) => product.VID).join("\r\n");
    }

    // 搜索相关数据与逻辑
    const defaultForm = {
      RID: "",
      RID_exclude: false,
    };

    const searchForm = ref({});

    function handleReset() {
      searchForm.value = JSON.parse(JSON.stringify(defaultForm));
      mergeProducts.value = JSON.parse(mergeInfoListBackUp);
    }

    onMounted(() => {
      searchForm.value = JSON.parse(JSON.stringify(defaultForm));
    });

    function checkSearch() {
      return JSON.stringify(searchForm.value) == JSON.stringify(defaultForm);
    }

    function filterRID() {
      let filterRes = JSON.parse(mergeInfoListBackUp).filter(
        info => info.RID === searchForm.value.RID
      );

      return filterRes;
    }

    function filterRIDExclude() {
      let filterRes = JSON.parse(mergeInfoListBackUp).filter(
        info => info.RID !== searchForm.value.RID
      );

      return filterRes;
    }

    function handleSearch() {
      if (checkSearch()) {
        mergeProducts.value = JSON.parse(mergeInfoListBackUp);

        return;
      }

      let searchRes = [];

      if (searchForm.value.RID_exclude) {
        searchRes = filterRIDExclude();
      } else {
        searchRes = filterRID();
      }
      console.info("搜索结果：", searchRes);

      formatListData(sortSamePID(searchRes));

      // mergeProducts.value = searchRes;
    }

    return {
      products,
      mergeProducts,
      openCoupangLink,
      checkMergeObj,
      mergeInfoList,
      PIDSpanMethod,
      handleCopy,
      searchForm,
      handleReset,
      handleSearch,
    };
  },
});

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  APP.component(key, component);
}

APP.use(ElementPlus).mount("#app");
