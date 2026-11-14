import jquery from 'dsh-nexttavern-reader-native-jquery'
import lodash from 'dsh-nexttavern-reader-native-lodash'
import authorGlobals from 'dsh-nexttavern-reader-native-author-globals'
import vue from 'dsh-nexttavern-reader-native-vue'
import type {ReaderNativeLibraryV1} from '../core/reader-native-document-types.js'

/** Product-pinned library bytes run only inside the isolated author page. */
export const READER_NATIVE_DOCUMENT_LIBRARIES:readonly ReaderNativeLibraryV1[]=Object.freeze([
  {name:'jquery@3.7.1',javascript:jquery},
  {name:'lodash@4.18.1',javascript:lodash},
  {name:'yaml@2.8.1+zod@4.6.5',javascript:authorGlobals},
  {name:'vue@3.5.45',javascript:vue},
])
