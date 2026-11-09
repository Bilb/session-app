#!/usr/bin/env python3
"""
Keeps the project board in step with the repo, so nobody moves cards by hand.

- Every issue and pull request is on the board.
- A pull request's Status follows it: draft or changes requested is In progress, ready is In review,
  approved is Approved, merged or closed is Done.
- An issue with an open pull request that will close it takes that pull request's Status.
- Any other open issue is Ready when nothing it is blocked by is still open and it is scheduled for an
  app release (it has a milestone), and Backlog otherwise, which keeps an unsorted user report out of
  Ready until triage gives it a milestone. One someone moved to In progress by hand is left there.
- "Waiting on" lists the open issues an issue is blocked by.
- "Release" mirrors each issue's milestone as a single-select, so a view grouped by it lists the
  releases in the order of the field's options, which people set by dragging them in the field's
  settings: a milestone view can only sort by due date. A milestone with no option gets one at the
  end, one that is gone loses its option, and a renamed one keeps its option and place.

Closing a release's milestone folds the closed issues of Next into it (FOLD_INTO=<title>): fixes
made between releases ship with the release that follows them.

Blocked-by links fire no event, so the workflow also runs on a schedule. With POST_STATUS=1 it
posts a progress update to the project instead.
"""
import json
import os
import subprocess
import sys
import time

REPO = os.environ['REPO']
OWNER = os.environ['PROJECT_OWNER']
NUMBER = int(os.environ['PROJECT_NUMBER'])
OWNER_KIND = os.environ.get('PROJECT_OWNER_KIND', 'user')
AREA_LABEL = 'area'
# Fixes between releases, folded into the next release when it closes.
NEXT = 'Next'
ORDER = ['Backlog', 'Ready', 'In progress', 'In review', 'Approved', 'Done']


def gh(args, payload=None):
    for attempt in range(4):
        out = subprocess.run(['gh', *args], input=None if payload is None else json.dumps(payload),
                             capture_output=True, text=True)
        # GitHub's GraphQL endpoint fails now and then with a generic error that a retry clears.
        if 'Something went wrong' in out.stdout and attempt < 3:
            time.sleep(3 * (attempt + 1))
            continue
        if out.returncode != 0:
            sys.exit(f'gh {" ".join(args[:3])} failed: {out.stdout} {out.stderr}')
        return out.stdout


def gql(query, **variables):
    data = json.loads(gh(['api', 'graphql', '--input', '-'], {'query': query, 'variables': variables}))
    if data.get('errors'):
        sys.exit(json.dumps(data['errors']))
    return data['data']


def rest(path):
    return json.loads(gh(['api', '--paginate', '--slurp', path]))


PROJECT = gql(
    f'query($o:String!,$n:Int!){{{OWNER_KIND}(login:$o){{projectV2(number:$n){{id fields(first:50){{nodes{{'
    '... on ProjectV2FieldCommon{id name} ... on ProjectV2SingleSelectField{options{id name color description}}}}}}}',
    o=OWNER, n=NUMBER)[OWNER_KIND]['projectV2']
PID = PROJECT['id']
FIELDS = {f['name']: f for f in PROJECT['fields']['nodes'] if f}
STATUS = FIELDS['Status']
OPTION = {o['name']: o['id'] for o in STATUS['options']}

ITEMS_QUERY = '''query($p:ID!,$after:String){node(id:$p){... on ProjectV2{items(first:100,after:$after){
  pageInfo{hasNextPage endCursor}
  nodes{id
    status:fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}
    waiting:fieldValueByName(name:"Waiting on"){... on ProjectV2ItemFieldTextValue{text}}
    release:fieldValueByName(name:"Release"){... on ProjectV2ItemFieldSingleSelectValue{optionId}}
    content{
      ... on Issue{__typename id number state milestone{title} labels(first:20){nodes{name}}}
      ... on PullRequest{__typename id number state isDraft reviewDecision
        closingIssuesReferences(first:20){nodes{number}}}}}}}}}'''


def items():
    found, after = [], None
    while True:
        page = gql(ITEMS_QUERY, p=PID, after=after)['node']['items']
        found += [i for i in page['nodes'] if i['content']]
        if not page['pageInfo']['hasNextPage']:
            return found
        after = page['pageInfo']['endCursor']


def set_status(item, name):
    gql('mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,'
        'itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){projectV2Item{id}}}',
        p=PID, i=item['id'], f=STATUS['id'], o=OPTION[name])


def set_waiting(item, text):
    if text:
        gql('mutation($p:ID!,$i:ID!,$f:ID!,$t:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,'
            'itemId:$i,fieldId:$f,value:{text:$t}}){projectV2Item{id}}}',
            p=PID, i=item['id'], f=FIELDS['Waiting on']['id'], t=text)
    else:
        gql('mutation($p:ID!,$i:ID!,$f:ID!){clearProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,'
            'fieldId:$f}){projectV2Item{id}}}', p=PID, i=item['id'], f=FIELDS['Waiting on']['id'])


MILESTONE_TAG = 'Milestone #'


def sync_release_options():
    """
    Keeps one Release option per milestone, in the order people gave them and with each option's id
    (so no issue loses its value). An option names its milestone's number in its description, so a
    renamed milestone keeps its option and its place; one for a milestone with no option goes at the
    end, and one whose milestone is gone is dropped. Returns the option id for each milestone title,
    and the titles in the field's order.
    """
    field = FIELDS['Release']
    milestones = [m for page in rest(f'repos/{REPO}/milestones?state=all&per_page=100') for m in page]
    by_number = {m['number']: m for m in milestones}
    by_title = {m['title']: m for m in milestones}

    def milestone_of(option):
        description = option.get('description') or ''
        if description.startswith(MILESTONE_TAG) and description[len(MILESTONE_TAG):].isdigit():
            return by_number.get(int(description[len(MILESTONE_TAG):]))
        return by_title.get(option['name'])

    def wanted(milestone, option=None):
        kept = {} if option is None else {'id': option['id'], 'color': option.get('color') or 'GRAY'}
        return {'color': 'GRAY', **kept, 'name': milestone['title'],
                'description': f"{MILESTONE_TAG}{milestone['number']}"}

    options, seen = [], set()
    for option in field['options']:
        milestone = milestone_of(option)
        if milestone is not None and milestone['number'] not in seen:
            seen.add(milestone['number'])
            options.append(wanted(milestone, option))
    for m in sorted(milestones, key=lambda m: (m['title'] == NEXT, m['number'])):
        if m['number'] not in seen:
            options.append(wanted(m))

    def shape(o):
        return (o.get('id'), o['name'], o.get('description') or '')

    if [shape(o) for o in options] != [shape(o) for o in field['options']]:
        updated = gql('mutation($f:ID!,$o:[ProjectV2SingleSelectFieldOptionInput!]!){updateProjectV2Field('
                      'input:{fieldId:$f,singleSelectOptions:$o}){projectV2Field{... on '
                      'ProjectV2SingleSelectField{options{id name color description}}}}}',
                      f=field['id'], o=options)
        field['options'] = updated['updateProjectV2Field']['projectV2Field']['options']
    ordered = [o['name'] for o in field['options']]
    return {o['name']: o['id'] for o in field['options']}, ordered


def set_release(item, option):
    field = FIELDS['Release']['id']
    if option is None:
        gql('mutation($p:ID!,$i:ID!,$f:ID!){clearProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,'
            'fieldId:$f}){projectV2Item{id}}}', p=PID, i=item['id'], f=field)
    else:
        gql('mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,'
            'itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){projectV2Item{id}}}',
            p=PID, i=item['id'], f=field, o=option)


def pr_status(pr):
    if pr['state'] != 'OPEN':
        return 'Done'
    if pr['isDraft'] or pr['reviewDecision'] == 'CHANGES_REQUESTED':
        return 'In progress'
    if pr['reviewDecision'] == 'APPROVED':
        return 'Approved'
    return 'In review'


def sync():
    on_board = {i['content']['id'] for i in items()}
    added = False
    for page in rest(f'repos/{REPO}/issues?state=all&per_page=100'):
        for issue in page:
            if issue['node_id'] not in on_board:
                gql('mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}}',
                    p=PID, c=issue['node_id'])
                print(f'added #{issue["number"]}')
                added = True

    # A card just added is missing from the next read for a moment.
    if added:
        time.sleep(5)
    board = items()
    open_prs = {i['content']['number']: i['content'] for i in board
                if i['content']['__typename'] == 'PullRequest' and i['content']['state'] == 'OPEN'}
    closing = {}
    for pr in open_prs.values():
        for issue in pr['closingIssuesReferences']['nodes']:
            closing.setdefault(issue['number'], []).append(pr)

    release_options, _ = sync_release_options()
    for item in board:
        content = item['content']
        if content['__typename'] != 'Issue':
            continue
        wanted = None if content['milestone'] is None else release_options.get(content['milestone']['title'])
        if wanted != (item['release'] or {}).get('optionId'):
            set_release(item, wanted)

    for item in board:
        content = item['content']
        current = (item['status'] or {}).get('name')
        if content['__typename'] == 'PullRequest':
            wanted, waiting = pr_status(content), ''
        elif AREA_LABEL in [l['name'] for l in content['labels']['nodes']]:
            continue
        else:
            blockers = [] if content['state'] != 'OPEN' else [
                b for page in rest(f'repos/{REPO}/issues/{content["number"]}/dependencies/blocked_by?per_page=100')
                for b in page if b['state'] == 'open']
            waiting = ', '.join(f'#{b["number"]} {b["title"][:48]}' for b in blockers)
            if content['state'] != 'OPEN':
                wanted = 'Done'
            elif content['number'] in closing:
                wanted = max((pr_status(pr) for pr in closing[content['number']]), key=ORDER.index)
            elif current == 'In progress':
                wanted = current
            elif blockers or content['milestone'] is None:
                wanted = 'Backlog'
            else:
                wanted = 'Ready'
        if wanted != current:
            set_status(item, wanted)
            print(f'#{content["number"]}: {current} -> {wanted}')
        if waiting != ((item['waiting'] or {}).get('text') or ''):
            set_waiting(item, waiting)


def post_status():
    lines = ['**Where the project is up to**', '', '| Release | Done | Progress |', '| --- | --- | --- |']
    milestones = [m for page in rest(f'repos/{REPO}/milestones?state=all&per_page=100') for m in page]
    # In the order of the Release field's options, which is the order people gave the releases.
    _, ordered = sync_release_options()
    rank = {title: at for at, title in enumerate(ordered)}
    for m in sorted(milestones, key=lambda m: (rank.get(m['title'], len(rank)), m['number'])):
        total = m['open_issues'] + m['closed_issues']
        pct = round(100 * m['closed_issues'] / total) if total else 0
        lines.append(f"| {m['title']} | {m['closed_issues']} of {total} | {'█' * (pct // 10)}{'░' * (10 - pct // 10)} {pct}% |")
    lines += ['', '| Area | Done |', '| --- | --- |']
    for page in rest(f'repos/{REPO}/issues?labels={AREA_LABEL}&state=all&per_page=100'):
        for issue in page:
            s = issue.get('sub_issues_summary') or {}
            lines.append(f"| {issue['title']} | {s.get('completed', 0)} of {s.get('total', 0)} ({s.get('percent_completed', 0)}%) |")
    gql('mutation($p:ID!,$b:String!){createProjectV2StatusUpdate(input:{projectId:$p,body:$b}){statusUpdate{id}}}',
        p=PID, b='\n'.join(lines))
    print('posted a status update')


def fold_next(into):
    """Moves Next's closed issues into the release whose milestone just closed."""
    if into == NEXT:
        return
    milestones = {m['title']: m['number'] for page in rest(f'repos/{REPO}/milestones?state=all&per_page=100') for m in page}
    if NEXT not in milestones or into not in milestones:
        return
    for page in rest(f'repos/{REPO}/issues?milestone={milestones[NEXT]}&state=closed&per_page=100'):
        for issue in page:
            if 'pull_request' in issue:
                continue
            gh(['api', '-X', 'PATCH', f'repos/{REPO}/issues/{issue["number"]}', '-F', f'milestone={milestones[into]}'])
            print(f'#{issue["number"]}: {NEXT} -> {into}')


if __name__ == '__main__':
    if os.environ.get('FOLD_INTO'):
        fold_next(os.environ['FOLD_INTO'])
    post_status() if os.environ.get('POST_STATUS') == '1' else sync()
