/** Knowledge Planet 类型定义 */

export interface Satellite {
  id: string;
  name: string;
  color: string;
  period: number; // 公转周期（秒）
  rotation: number; // 轨道倾斜角度（度）
  xRadius: number; // 椭圆 X 半径（px）
  yRadius: number; // 椭圆 Y 半径（px）
  notes: number;
  lastUpdated: string;
}
