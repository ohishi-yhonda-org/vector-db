#!/usr/bin/env python3
"""
カバレッジ情報を解析して優先度順に表示するスクリプト
"""

import json
import re
import sys
from datetime import datetime
from collections import defaultdict

def parse_coverage():
    try:
        # カバレッジファイル読み込み
        with open('coverage-raw.json', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # テキストからカバレッジ部分を抽出
        lines = content.split('\n')
        coverage_lines = []
        in_coverage = False
        
        for line in lines:
            # カバレッジテーブルの開始を検出
            if '% Stmts' in line and '% Branch' in line:
                in_coverage = True
                continue
            # カバレッジテーブルの終了を検出  
            if in_coverage and line.strip().startswith('---'):
                break
            if in_coverage and line.strip() and not line.startswith(' Test Files'):
                coverage_lines.append(line)
        
        # カテゴリ別にパース
        categories = {}
        current_category = None
        
        for line in coverage_lines:
            line = line.strip()
            if not line or line.startswith('All files') or '|' not in line:
                continue
                
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 5:
                name = parts[0]
                stmt_pct = parts[1].replace('%', '')
                
                try:
                    pct = float(stmt_pct) if stmt_pct != '' else 0
                except ValueError:
                    continue
                
                # カテゴリ判定
                if not name.startswith(' ') and not '.' in name:
                    # これはカテゴリ名
                    current_category = name
                    categories[current_category] = {
                        'coverage': pct,
                        'files': []
                    }
                elif name.startswith(' ') and current_category:
                    # これはファイル名
                    categories[current_category]['files'].append({
                        'name': name.strip(),
                        'coverage': pct
                    })
        
        # 優先度リスト（計画に基づく）
        priority_list = [
            'middleware',
            'routes/api/embeddings',
            'utils', 
            'workflows',
            'routes/api/search',
            'routes/api/vectors', 
            'routes/api/notion',
            'durable-objects',
            'routes/api/files',
            'services',
            'base'
        ]
        
        print(f"📊 カバレッジ分析結果 ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})")
        print("=" * 60)
        
        # 優先度順に表示
        for i, category in enumerate(priority_list):
            if category in categories:
                pct = categories[category]['coverage']
                if pct < 25:
                    status = '🔴 最優先'
                elif pct < 50:
                    status = '🟡 高優先'  
                elif pct < 75:
                    status = '🟠 中優先'
                else:
                    status = '🟢 低優先'
                
                priority_mark = '⭐' if i < 2 else '⚡' if i < 4 else ''
                
                print(f"{priority_mark} {status} {category}: {pct}%")
                
                # 低カバレッジの場合、問題ファイルを表示
                if pct < 75 and categories[category]['files']:
                    low_files = [f for f in categories[category]['files'] if f['coverage'] < 50]
                    if low_files:
                        print(f"   📁 要改善ファイル:")
                        for file in low_files[:3]:  # 上位3つ
                            print(f"      • {file['name']}: {file['coverage']}%")
                print()
        
        # 次の推奨作業
        next_target = None
        for category in priority_list:
            if category in categories and categories[category]['coverage'] < 90:
                next_target = category
                break
        
        if next_target:
            print(f"🎯 次の作業対象: {next_target} (現在{categories[next_target]['coverage']}%)")
        else:
            print("🎉 全カテゴリ90%以上達成！")
        
        # トラッカーファイルに保存
        tracker = {
            'lastUpdated': datetime.now().isoformat(),
            'categories': categories,
            'priorityList': priority_list,
            'nextTarget': next_target
        }
        
        with open('coverage-tracker.json', 'w', encoding='utf-8') as f:
            json.dump(tracker, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 coverage-tracker.json を更新しました")
        return tracker
        
    except Exception as e:
        print(f"❌ エラー: {e}")
        return None

if __name__ == '__main__':
    parse_coverage()