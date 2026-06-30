jQuery( document ).ready(function($) {
    if($('#configurator-wrapper').length > 0) {

        // set defaults
        // 300 removed
        const
            mietbetriebsstunden = [200, 300, 500, 750, 1000, 1250],
            selbstbehalt = [1000, 2500],
            minMietdauer = 2,
            startYear = 2026;

        let
            startOffset = 4,
//new Date().getMonth() - 1,
            endOffset = startOffset + minMietdauer,
            // JCB:: const mietbetriebsstunden sichern, da die verfügbaren Stunden je nach Traktor variieren können
            mietbetriebsstundenAktiv = mietbetriebsstunden,
            // JCB:: modell merken, um die verfügbaren mietbetriebsstunden zu aktualisieren
            traktorData = null,
            dynamicSelectList = '',
            months = [
            'Januar',
            'Februar',
            'März',
            'April',
            'Mai',
            'Juni',
            'Juli',
            'August',
            'September',
            'Oktober',
            'November'
//            'Dezember'
        ],
            startEnd = $(months).length - minMietdauer;

        // call init functions in required order
        onInit();
        function onInit() {
            cloneSelectList();
            selectBrand();
            createMonthStartSelection();
            createMonthEndSelection();
            // JCB:: slider initialisieren mit verfügbaren mietbetriebsstunden des ersten traktors
            loadTraktorData(function(data) {
                let firstKey = Object.keys(data || {})[0];
                if (firstKey) {
                    updateMietbetriebsstundenSlider(extractMietbetriebsstunden(data[firstKey]));
                }
                updateZusatzleistungen();
                calculate();
            });
        }

        // clone select list to be able to reset the modified list
        function cloneSelectList() {
            dynamicSelectList = document.getElementById('selected-traktor').cloneNode(true);
            dynamicSelectList.id = "traktor-clone";
        }

        // set default brand selection and register click event listener
        function selectBrand() {
            $('.select-brand-item:first-child').children('.select-brand').addClass('selected');
            updateTraktorOptions( $('.select-brand:first-child').attr('data-index'));

            document.querySelectorAll('.select-brand').forEach(item => {
                item.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();

                    updateBrand(event.target);
                })
            })
        }

        function updateBrand(brandItem) {
            let brandId =  $(brandItem).attr('data-index');
            let traktorSelectCount = $(dynamicSelectList.innerHTML).filter(function() {
                return $(this).attr('data-brand') === brandId;
            }).length;

            // check whether tractors of the selected brand are available
            if(traktorSelectCount === 0) {
                noOptionsForBrand(brandItem);
                return;
            }

            $('.select-brand').removeClass('selected');
            $(brandItem).addClass('selected');
            updateTraktorOptions(brandId);
            // select rtk and front
            if(brandId == '7'){
            // Deutz-Fahr
            }
            // alternate startoffset for brand 25
            if(brandId == '25'){
                 startOffset = 4 ;
// new Date().getMonth() - 1;
                 endOffset = startOffset + minMietdauer;
             } else {
               startOffset = 4;
// new Date().getMonth() - 1;
               endOffset = startOffset + minMietdauer;
             }
//             console.log("startOffset:", startOffset);
             createMonthStartSelection();
             createMonthEndSelection();
        }

        // show tooltip with info message if no tractors of the brand are available
        function noOptionsForBrand(brandItem) {
            $(brandItem).tooltip({
                title: 'Aktuell nicht verfügbar',
                placement: 'top',
                trigger: 'hove',
                container: '.brand-select-wrapper',
                template: '<div class="tooltip small-tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner text-center"></div></div>',
            }).tooltip('show');

            $(brandItem).on('mouseleave', function() {
              $(this).tooltip('hide');
            });
        }

        // update traktor options based on selected brand
        function updateTraktorOptions(brandId) {
            document.getElementById('selected-traktor').innerHTML = dynamicSelectList.innerHTML;
            $('#select-traktor-wrapper').removeClass('disabled');
            $('#selected-traktor').removeAttr('disabled');

            $('#selected-traktor option').each(function() {
                $(this).removeAttr('disabled');

                if($(this).attr('data-brand') !== brandId) {
                    $(this).attr('hidden', 'hidden');
                    $(this).remove();
                } else {
                    $(this).removeAttr('hidden');

                    // disabled sold out tractors
                    if($(this).attr('data-disabled') == 1) {
                        $(this).attr('disabled', 'disabled');
                    }
                }
            });

            let autoSelectTraktor = $('#selected-traktor').find('option:not([hidden]):not([disabled]):first');
            $('#selected-traktor').val(autoSelectTraktor.val());
            $(autoSelectTraktor).attr('selected', 'selected');

            updateTraktorSelect();
            calculate();
        }

        $('#selected-traktor').on('change',  function(event) {
            updateTraktorSelect();
            calculate();
        });

        function updateTraktorSelect() {
            let traktorId = $('#selected-traktor').find('option:selected').attr('data-src');
            $('#select-traktor-wrapper').find('.open-datasheet').attr('data-src', traktorId);
            // JCB:: update available mietbetriebsstunden slider based on selected traktor
            loadTraktorData(function(data) {
                let selectedItem = $('#selected-traktor').val();
                if (data && data[selectedItem]) {
                    updateMietbetriebsstundenSlider(extractMietbetriebsstunden(data[selectedItem]));
                }
                updateZusatzleistungen();
            });
        }

        // create datepicker
        function createMonthStartSelection() {
            $('#mietstart option').remove();

            // comment in, to only show future dates
            /*if(moment().year() == startYear && moment().month() >= startOffset) {
                startOffset = moment().month() + 1;
            }*/

            $(months).each(function(index, value) {
                if(index > startOffset && index < startEnd) {
                    $('#mietstart').append('<option value="'+index+'">'+value+' '+startYear+'</option>');
                }
            });
            updateMietStundenMin();
        }

        $('#mietstart').on('change', function(event) {
            endOffset = +$(this).val() + minMietdauer - 1;
            createMonthEndSelection();
            calculate();
        });

        function createMonthEndSelection() {
            $('#mietende option').remove();
            $(months).each(function(index, value) {
                if(index > endOffset) {
                    $('#mietende').append('<option value="'+index+'">'+value+' '+startYear+'</option>');
                }
            });
            updateMietStundenMin();
        }

        $('#mietende').on('change', function(event) {
            updateMietStundenMin();
            calculate();
        });

        function updateMietStundenMin() {
            let min = 0;
            // if the rental period exceeds three months, disable the rental operating hours 300
            // obsolete in 2024
            /*let rentDuration = +$('#mietende').val() - +$('#mietstart').val();
            if(rentDuration >= 3 || $('.select-brand.selected').attr('data-name') === 'Fendt') {
                min = 1;
            }*/

            $('#mietbetriebsstunden').attr('min', min);
            if($('#mietbetriebsstunden').val() <= min) {
                $('#mietbetriebsstunden').val(min);
                $('#mietbetriebsstunden-value').text(mietbetriebsstundenAktiv[min]);
            }
        }

        function updateMietStundenMax() {
            let max = mietbetriebsstundenAktiv.length - 1;

            /* obsolete in 2024
            if($('.select-brand.selected').attr('data-name') === 'Fendt') {
                max = 2;
            }*/

            $('#mietbetriebsstunden').attr('max', max);
            if($('#mietbetriebsstunden').val() >= max) {
                $('#mietbetriebsstunden').val(max)
                $('#mietbetriebsstunden-value').text(mietbetriebsstundenAktiv[max]);
            }
        }

        $('#mietbetriebsstunden').on('change, input', function() {
            $('#mietbetriebsstunden-value').text(mietbetriebsstundenAktiv[this.value]);
        });

        $('#selbstbehalt').on('change, input', function() {
            $('#selbstbehalt-value').text(selbstbehalt[this.value]);
        });

        function loadTraktorData(callback) {
            if (traktorData) {
                callback(traktorData);
                return;
            }
            $.getJSON("/fileadmin/data/traktoren.json", function(data) {
                traktorData = data;
                callback(traktorData);
            });
        }

        function extractMietbetriebsstunden(selectedItemData) {
            if (
                !selectedItemData ||
                !selectedItemData.mietbetriebsstunden ||
                Object.keys(selectedItemData.mietbetriebsstunden).length === 0
            ) {
                return mietbetriebsstunden;
            }

            return Object.keys(selectedItemData.mietbetriebsstunden)
                .map(value => Number(value))
                .filter(value => !Number.isNaN(value))
                .sort((a, b) => a - b);
        }

        function updateMietbetriebsstundenSlider(availableHours) {
            if (!availableHours || availableHours.length === 0) {
                availableHours = mietbetriebsstunden;
            }

            mietbetriebsstundenAktiv = availableHours;
            let min = 0;
            let max = availableHours.length - 1;
            let value = Math.max(0, availableHours.length - 2);

            $('#mietbetriebsstunden').attr('min', min);
            $('#mietbetriebsstunden').attr('max', max);
            $('#mietbetriebsstunden').val(value);
            $('#mietbetriebsstunden-value').text(availableHours[value]);
        }

        // update zusatzleistungen
        function updateZusatzleistungen() {
            let selectedItem = $('#selected-traktor').val();

            loadTraktorData(function(data) {
                let selectedItemData = data ? data[selectedItem] : null;

                // sichere Prüfung ohne Fehler bei fehlenden Attributen
                const hasRtk =
                    selectedItemData &&
                    selectedItemData.zusatzausstattung &&
                    typeof selectedItemData.zusatzausstattung.rtk !== 'undefined';
                const hasFzw =
                    selectedItemData &&
                    selectedItemData.zusatzausstattung &&
                    typeof selectedItemData.zusatzausstattung.fzw !== 'undefined';
                const hasLes =
                    selectedItemData &&
                    selectedItemData.zusatzausstattung &&
                    typeof selectedItemData.zusatzausstattung.les !== 'undefined';
                const hasZwa =
                    selectedItemData &&
                    selectedItemData.zusatzausstattung &&
                    typeof selectedItemData.zusatzausstattung.zwa !== 'undefined';
                const hasPal =
                    selectedItemData &&
                    selectedItemData.zusatzausstattung &&
                    typeof selectedItemData.zusatzausstattung.pal !== 'undefined';
                const hasErd =
                    selectedItemData &&
                    selectedItemData.zusatzausstattung &&
                    typeof selectedItemData.zusatzausstattung.erd !== 'undefined';
                const hasGre =
                    selectedItemData &&
                    selectedItemData.zusatzausstattung &&
                    typeof selectedItemData.zusatzausstattung.gre !== 'undefined';
                const hasSon =
                    selectedItemData &&
                    selectedItemData.zusatzausstattung &&
                    typeof selectedItemData.zusatzausstattung.son !== 'undefined';

                if (hasRtk) {
                   // console.log('Lenksystem vorhanden');
                    // sichtbar machen und status setzen
                    updateZusatzleistungenStatus('lenksysteme', selectedItemData.zusatzausstattung.rtk);
                } else {
                    // ausblenden
                    // console.log('Lenksystem nicht vorhanden');
                    updateZusatzleistungenStatus('lenksysteme', 0, false);
                }
                if (hasFzw) {
                    // console.log('Frontzapfwelle vorhanden');
                    // sichtbar machen und status setzen
                    updateZusatzleistungenStatus('frontzapfwelle', selectedItemData.zusatzausstattung.fzw);
                } else {
                    // ausblenden
                    //console.log('Frontzapfwelle nicht vorhanden');
                    updateZusatzleistungenStatus('frontzapfwelle', 0, false);
                }
                if (hasLes) {
                   // console.log('Lenksystem vorhanden');
                    // sichtbar machen und status setzen
                    updateZusatzleistungenStatus('lenksystem', selectedItemData.zusatzausstattung.les);
                } else {
                    // ausblenden
                    // console.log('Lenksystem nicht vorhanden');
                    updateZusatzleistungenStatus('lenksystem', 0, false);
                }
                if (hasZwa) {
                    // console.log('Frontzapfwelle vorhanden');
                    // sichtbar machen und status setzen
                    updateZusatzleistungenStatus('zwangslenkung', selectedItemData.zusatzausstattung.zwa);
                } else {
                    // ausblenden
                    //console.log('Zwangslenkung nicht vorhanden');
                    updateZusatzleistungenStatus('zwangslenkung', 0, false);
                }


                if (hasPal) {
                    // console.log('Palettengabel vorhanden');
                    updateZusatzleistungenStatus('palettengabel', selectedItemData.zusatzausstattung.pal, true);
                    // sichtbar machen und status setzen
                    //updateZusatzleistungenStatus('palettengabel', selectedItemData.zusatzausstattung.pal);
                } else {
                    // ausblenden
                    // console.log('Palettengabel nicht vorhanden');
                    updateZusatzleistungenStatus('palettengabel', 0, false);
                }
                if (hasErd) {
                    // console.log('Universalschaufel vorhanden');
                    updateZusatzleistungenStatus('universalschaufel', selectedItemData.zusatzausstattung.erd, true);
                    // sichtbar machen und status setzen
                    //updateZusatzleistungenStatus('universalschaufel', selectedItemData.zusatzausstattung.erd);
                } else {
                    // ausblenden
                    // console.log('Universalschaufel nicht vorhanden');
                    updateZusatzleistungenStatus('universalschaufel', 0, false);
                }
                if (hasGre) {
                    // console.log('Greifschaufel vorhanden');
                    updateZusatzleistungenStatus('greifschaufel', selectedItemData.zusatzausstattung.gre, true);
                    // sichtbar machen und status setzen
                    //updateZusatzleistungenStatus('greifschaufel', selectedItemData.zusatzausstattung.gre);
                } else {
                    // ausblenden
                    // console.log('Greifschaufel nicht vorhanden');
                    updateZusatzleistungenStatus('greifschaufel', 0, false);
                }
                if (hasSon) {
                    // console.log('Sonstiges vorhanden');
                    updateZusatzleistungenStatus('sonstiges', selectedItemData.zusatzausstattung.son, true);
                    // sichtbar machen und status setzen
                    //updateZusatzleistungenStatus('sonstiges', selectedItemData.zusa   tzausstattung.son);
                } else {
                    // ausblenden
                    // console.log('Sonstiges nicht vorhanden');
                    updateZusatzleistungenStatus('sonstiges', 0, false);
                }
                calculate();
            });
        }

        // set attributes for zusatzleistungen checkbox
        function updateZusatzleistungenStatus(id, value, visible = true) {
            //console.log("ID:", id, "Value:", value);
            let zusatzleistung = document.getElementById(id);
            const status = [false, false, true];
            const parentStatus = ['readonly', '', 'readonly'];
            const parent = $(zusatzleistung).parent('.custom-control');

            /*$(zusatzleistung)
                .prop(status[value]);*/

            zusatzleistung.checked = status[value];

            $(parent[0])
                .removeClass('readonly')
                .addClass(parentStatus[value]);
            if (!visible) {
                $(parent[0]).hide();
            } else {
                $(parent[0]).show();
            }
        }

        $("#configurator-form").on('change', 'input', function(){
            calculate();
        });

        function calculate() {
            let formElement = document.querySelector("#configurator-form");
            let formData = new FormData(formElement);
            formData.append('traktor', $('#selected-traktor').find('option:selected').val());
            formData.append('mietbetriebsstunden', $('#mietbetriebsstunden-value').text());

            let request = new XMLHttpRequest();
//            request.open("POST", "/typo3conf/ext/traktor_configurator/Classes/Configurator.php", true);
            request.open("POST", "/tractor-calculation", true);
            request.send(formData);

            request.onreadystatechange = function() {
                if (this.readyState === 4 && this.status === 200) {
                    // console.log(this.responseText);
                    let sumArray = JSON.parse(this.responseText);
                    //console.table(sumArray);
                    document.getElementById("sumMonth").innerHTML = sumArray['sumMonth'];
                    document.getElementById("sumHour").innerHTML = sumArray['sumHour'];
                }
            };

            if ($('#mietstart').val() !== 0 && $('#mietende').val()) {
                $('#sum-wrapper').addClass('show');
            } else {
                $('#sum-wrapper').removeClass('show');
            }
        }

        // open datasheet
        $('.open-datasheet').on('click', function (event) {
            event.stopPropagation();
            event.preventDefault();

            let dataId = $(this).attr('data-src');

            $('.configurator-overlay').find('.traktor-item').each(function() {
                if($(this).attr('data-src') === dataId) {
                    $(this).addClass('active');
                } else {
                    $(this).removeClass('active');
                }
            });

            $('.configurator-overlay').fadeIn(700);
            $('#configurator-form-wrapper').addClass('datasheet-open');
        });

        // submit anfrage
        $('#configurator-form').on('submit', function(event) {
            event.preventDefault();
            $('.form-data').show();
            formMapping();
            openOverlay(document.getElementById('c57'));
        })

        // close overlay
        $(document).on('click', '.close-datasheet', function (){
            $('.configurator-overlay').fadeOut(700);
            $('#configurator-form-wrapper').removeClass('datasheet-open');
            $('.form-data').hide();

            let activeItem =  $('.configurator-overlay').find('.traktor-item.active');
            if(activeItem) {
                $(activeItem[0]).removeClass('active');
            }
        })

        // map for fields to configurator data
        let formId = 57;
        function formMapping() {
            let formElement = document.querySelector("#configurator-form");
            let formData = new FormData(formElement);

            // get fields
            for(let formItem of formData.entries()) {
                let id = 'anfrageformular-'+formId+'-'+formItem[0];
                let element = document.getElementById(id);
                let value;

                switch (formItem[0]) {
                    case 'selected-traktor':
                        value = $('#selected-traktor').val();
                        break;
                    case "mietbetriebsstunden":
                        value = mietbetriebsstundenAktiv[formItem[1]];
                        break;
                    case "selbstbehalt":
                        value = selbstbehalt[formItem[1]];
                        break;
                    case "mietstart":
                        value = months[formItem[1]]+' '+startYear;
                        break;
                    case "mietende":
                        value = months[formItem[1]]+' '+startYear;
                        break;
                    default:
                        value = formItem[1];
                 }

                $(element).val(value);
            }

            // map calculated monthly rental price into mail form
            let mietpreisElement = document.getElementById('anfrageformular-'+formId+'-mietpreis');
            if (mietpreisElement) {
                $(mietpreisElement).val($('#sumMonth').text().trim());
            }

            let sumHourElement = document.getElementById('anfrageformular-'+formId+'-sumHour');
            if (sumHourElement) {
                $(sumHourElement).val($('#sumHour').text().trim());
            }
        }

        // hide data fields in form
        $('.config-data').parents('.form-group').hide();

        // show success message after form send
        if (window.location.href.indexOf("anfrageformular-57") > -1) {
            openOverlay(document.getElementById('c57'));
            $('.form-data').show();

            $(document).on('click', '.close-datasheet', function() {
                window.history.replaceState({}, document.title, "/");
                location.reload();
            });
        }

        /*
        * open overlay with dynamic data
        */
        function openOverlay(data) {
            $(".configurator-overlay .form-data").html($(data).clone());
            $('.configurator-overlay').fadeIn(700);
            $('#configurator-form-wrapper').addClass('datasheet-open');
            // attach gtag event to submit button
            $('button[name="tx_form_formframework[anfrageformular-57][__currentPage]"]').click(function(event) {
               if (typeof gtag === 'function') {
                  gtag('event', 'form_request_submit', {
                    'event_category': 'Formular',
                    'event_label': 'Anfrage Formular'
                   });
                   //console.log( 'GTAG Event fire form_request_submit');
                   //event.preventDefault();
                 }
            });
            // end attach
        }
    }

    // tooltip
    if($('.tooltip-anchor').length > 0) {
        $('.tooltip-anchor').each(function() {
            let tooltipAnchor = $(this).attr('href');
            let tooltipBody = $(tooltipAnchor).html();
            if (tooltipBody) {
                $(this).attr('title', tooltipBody);
            }
        });

        $('.tooltip-anchor').tooltip({
            html: true,
            placement: ('ontouchstart' in window) ? 'bottom' : 'left'
        });
    }

    if('ontouchstart' in window) {
        $('.tooltip-anchor').on('touchstart', function (event){
            event.preventDefault();
            $(this).tooltip('show');
        });
        document.onclick = function(event){
            if($(event.target).parents('.tooltip').length === 0) {
                $('.tooltip.show').tooltip('hide');
            }
        };
    }

    $(document).on('click', '.close-overlay', function (e) {
        e.preventDefault();
        $(this).parents('.traktor-item-overlay').removeClass('datasheet-open');
        let overlay = $(this).parents('.traktor-item').find('.traktor-item-overlay');
        $(overlay).fadeOut(200)
    })

    $(document).on('click', '.traktor-item-more', function (e) {
        e.preventDefault();
        let overlay = $(this).parents('.traktor-item').find('.traktor-item-overlay');
        $(overlay).addClass('datasheet-open')
        $(overlay).fadeIn(200);
    })

    $(document).on('click', '.traktor-item-config', function (e) {
        e.preventDefault();

        let selectedCategory = document.querySelectorAll(".select-brand[data-index='"+$(this).data('category')+"']");
        updateBrand(selectedCategory[0]);

        let selectedTraktor = $('#selected-traktor').find("[data-src='"+$(this).data('src')+"']");
        $('#selected-traktor').val(selectedTraktor.val());
        $(selectedTraktor).attr('selected', 'selected');

        calculate();

        $([document.documentElement, document.body]).animate({
            scrollTop: $("#configurator-wrapper").offset().top
        }, 800);
    })
  try {
    const sliderElement = document.querySelector('.traktor-slider');
    if (sliderElement) {
      const navElement = document.querySelector('.traktor-slider-nav');
      let slider = tns({
        container: '.traktor-slider',
        items: 1,
        slideBy: 'page',
        autoplay: false,
        controlsPosition: 'bottom',
        navPosition: 'bottom',
        controlsText: ['<i class="fa-solid fa-angle-left"></i>', '<i class="fa-solid fa-angle-right"></i>'],
        navContainer: '.traktor-slider-nav',
        lazyload: true,
        loop: false,
    });
   }

  } catch (error) {
    //console.error("Fehler beim Initialisieren des Sliders:", error);
   }
    // init effects
    AOS.init({
        anchorPlacement: 'top-bottom',
        offset: 0
    });

    // attach gtag event to submit button
            $('button[name="tx_form_formframework[kontakt-89][__currentPage]"]').click(function(event) {
               if (typeof gtag === 'function') {
                  gtag('event', 'form_contact_submit', {
                    'event_category': 'Formular',
                    'event_label': 'Kontakt Formular'
                   });
                   //console.log( 'GTAG Event fire form_contact_submit');
                   //event.preventDefault();
                 }
            });
    // end attach

});
